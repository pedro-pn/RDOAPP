/*
 * Parser da planilha de jornada exportada do Pontomais (módulo Acompanhamento).
 *
 * O .xlsx é um ZIP de XML — lemos com adm-zip + @xmldom/xmldom (já dependências do projeto), sem
 * adicionar SheetJS. Layout do arquivo (uma aba, blocos por colaborador):
 *
 *   Colaborador | <nome>
 *   Data | 1ª Entrada | ... | Horas normais | Horas extras acumulativas | ... | Adic. noturno | Motivo
 *   Seg, 01/06/2026 | ... valores diários ...
 *   ...
 *   TOTAIS | ...
 *   Resumo | Totais
 *   Horas extras acumuladas 70% | 30:00
 *   Horas extras acumuladas 100% | 08:01
 *
 * Observação: o split 70%/100% só existe no "Resumo" (nível do período); por dia só há o total de
 * horas extras acumulativas (coluna L = HE70 + HE100).
 */

import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

// "183:14" -> 11 mil e poucos minutos. parseHm de overtime.js só aceita 1–2 dígitos de hora, então
// temos um parser próprio que aceita qualquer número de horas.
export function hmToMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const match = String(value ?? '').trim().match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function columnOf(ref) {
  const match = ref.match(/^[A-Z]+/);
  return match ? match[0] : '';
}

function rowOf(ref) {
  const match = ref.match(/\d+$/);
  return match ? Number(match[0]) : 0;
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHeaderMap(cells) {
  const header = { dateCol: null, normalCol: null, extrasCol: null, nightCol: null, reasonCol: null };
  for (const [col, value] of Object.entries(cells)) {
    const name = normalizeHeader(value);
    if (name === 'data') header.dateCol = col;
    else if (name === 'horas normais') header.normalCol = col;
    else if (name === 'horas extras acumulativas') header.extrasCol = col;
    else if (name === 'adicional noturno' || name === 'adic noturno') header.nightCol = col;
    else if (name.startsWith('motivo')) header.reasonCol = col;
  }
  return header;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = doc.getElementsByTagName('si');
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const texts = items[i].getElementsByTagName('t');
    let value = '';
    for (let j = 0; j < texts.length; j += 1) value += texts[j].textContent || '';
    out.push(value);
  }
  return out;
}

// Constrói um mapa linha -> { coluna: valor(string) } a partir do XML da worksheet.
function parseSheetRows(xml, shared) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const cells = doc.getElementsByTagName('c');
  const rows = new Map();
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const ref = cell.getAttribute('r');
    if (!ref) continue;
    const type = cell.getAttribute('t');
    let value = '';
    if (type === 'inlineStr') {
      const inline = cell.getElementsByTagName('t')[0];
      value = inline ? inline.textContent || '' : '';
    } else {
      const valueEl = cell.getElementsByTagName('v')[0];
      if (valueEl) {
        value = type === 's' ? shared[Number(valueEl.textContent)] || '' : valueEl.textContent || '';
      }
    }
    const rowNum = rowOf(ref);
    if (!rows.has(rowNum)) rows.set(rowNum, {});
    rows.get(rowNum)[columnOf(ref)] = value;
  }
  return rows;
}

function firstWorksheetXml(zip) {
  const preferred = zip.getEntry('xl/worksheets/sheet1.xml');
  if (preferred) return preferred.getData().toString('utf8');
  const entry = zip.getEntries().find(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.entryName));
  if (!entry) throw new Error('Planilha do ponto sem worksheet (xl/worksheets/sheetN.xml).');
  return entry.getData().toString('utf8');
}

/*
 * Recebe o buffer do .xlsx e devolve um bloco por colaborador:
 *   { rawName, days:[{ date:'YYYY-MM-DD', workedMinutes, extrasMinutes, nightMinutes, motivo }],
 *     he70Minutes, he100Minutes, workedMinutes, nightMinutes, periodStart, periodEnd, workedDays }
 * Também devolve o período global (menor/maior data) e a contagem de linhas lidas.
 */
export function parsePonto(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Arquivo do ponto vazio.');
  }
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (error) {
    throw new Error(`Arquivo não parece um .xlsx válido: ${error.message}`);
  }
  const sharedEntry = zip.getEntry('xl/sharedStrings.xml');
  const shared = parseSharedStrings(sharedEntry ? sharedEntry.getData().toString('utf8') : '');
  const rows = parseSheetRows(firstWorksheetXml(zip), shared);

  const sortedRowNums = [...rows.keys()].sort((a, b) => a - b);
  const blocks = [];
  let current = null;
  let currentHeader = null;
  let rowsRead = 0;

  for (const rowNum of sortedRowNums) {
    const cells = rows.get(rowNum);
    const a = (cells.A || '').trim();
    const b = (cells.B || '').trim();

    if (a === 'Colaborador') {
      current = { rawName: b, days: [], he70Minutes: 0, he100Minutes: 0 };
      currentHeader = null;
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const header = buildHeaderMap(cells);
    if (header.dateCol) {
      if (!header.normalCol) {
        throw new Error(`Cabeçalho "Horas normais" não encontrado na linha ${rowNum} da planilha do ponto.`);
      }
      currentHeader = header;
      continue;
    }
    if (a === 'TOTAIS' || a === 'Resumo') continue;
    if (/^Horas extras acumuladas 70%/i.test(a)) { current.he70Minutes = hmToMinutes(b); continue; }
    if (/^Horas extras acumuladas 100%/i.test(a)) { current.he100Minutes = hmToMinutes(b); continue; }

    const dateValue = currentHeader?.dateCol ? cells[currentHeader.dateCol] : a;
    const dateMatch = String(dateValue ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) continue;
    if (!currentHeader?.normalCol) {
      throw new Error(`Cabeçalho "Horas normais" não encontrado antes da linha ${rowNum} da planilha do ponto.`);
    }
    const [, dd, mm, yyyy] = dateMatch;
    rowsRead += 1;
    current.days.push({
      date: `${yyyy}-${mm}-${dd}`,
      workedMinutes: hmToMinutes(cells[currentHeader.normalCol]),
      extrasMinutes: hmToMinutes(currentHeader.extrasCol ? cells[currentHeader.extrasCol] : null),
      nightMinutes: hmToMinutes(currentHeader.nightCol ? cells[currentHeader.nightCol] : null),
      motivo: currentHeader.reasonCol ? (cells[currentHeader.reasonCol] || '').trim() || null : null
    });
  }

  let periodStart = null;
  let periodEnd = null;
  for (const block of blocks) {
    block.workedMinutes = block.days.reduce((sum, d) => sum + d.workedMinutes, 0);
    block.nightMinutes = block.days.reduce((sum, d) => sum + d.nightMinutes, 0);
    // Dias efetivamente trabalhados (para cruzar com RDO): horas normais > 0.
    block.workedDays = block.days.filter(d => d.workedMinutes > 0).map(d => d.date);
    const dates = block.days.map(d => d.date).sort();
    block.periodStart = dates[0] || null;
    block.periodEnd = dates[dates.length - 1] || null;
    if (block.periodStart && (!periodStart || block.periodStart < periodStart)) periodStart = block.periodStart;
    if (block.periodEnd && (!periodEnd || block.periodEnd > periodEnd)) periodEnd = block.periodEnd;
  }

  return { blocks, periodStart, periodEnd, rowsRead };
}
