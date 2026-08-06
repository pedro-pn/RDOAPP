import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import { tabelasDePrecoDoModelo } from '../../../../shared/comercial/dist/modelo-documento.js';
import {
  cloneBefore,
  findFirstByText,
  removeNode,
  repetirLinha,
  repetirParagrafo,
  replacePlaceholders
} from '../docx/template.js';

/**
 * Preenche o modelo `.docx` da proposta.
 *
 * **Por que este caminho e não o gerador em `pdf-lib`.** O documento passou a
 * ser editável por quem o escreve: trocar um parágrafo, mudar a matriz padrão ou
 * corrigir uma cláusula é abrir o `.docx` em `Modelos/definitivos/Comercial/
 * modelos/` e salvar. Sem programador, sem deploy. O gerador programático
 * exigia código a cada vírgula.
 *
 * O que este módulo faz é só substituição: cada `{{marcador}}` vira valor, e
 * cada linha-modelo de tabela vira uma linha por registro. O layout, as fontes,
 * as imagens e o timbrado são do `.docx` — nada disso é redesenhado aqui.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODELOS = path.resolve(AQUI, '../../../../Modelos/definitivos/Comercial/modelos');

const ARQUIVOS = {
  'commercial:padrao': 'Proposta Comercial.docx',
  'commercial:hidrojateamento': 'Proposta comercial hidrojateamento.docx',
  'technical:padrao': 'Proposta técnica.docx',
  'technical:hidrojateamento': 'Proposta técnica hidrojateamento.docx'
};

/** As partes do pacote que podem conter marcador. */
const PARTES = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];

export function arquivoDoModelo(tipo, modelo) {
  return ARQUIVOS[`${tipo}:${modelo}`] || ARQUIVOS[`${tipo}:padrao`];
}

function formatarData(iso) {
  const bruto = String(iso || '').trim();
  if (!bruto) return '';
  const quando = new Date(`${bruto}T12:00:00Z`);
  if (Number.isNaN(quando.getTime())) return bruto;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    quando
  );
}

const moeda = valor =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(valor) ? valor : 0
  );

/**
 * Desfaz a máscara de moeda.
 *
 * Ponto é milhar e vírgula é decimal, ao contrário do que `Number` espera. Ler
 * "R$ 11.250,00" com `Number` daria `NaN`, e o total sairia "R$ NaN" impresso.
 */
function lerDinheiro(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '');
  const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

/** Os campos simples do cabeçalho e das condições. */
function camposSimples(dados) {
  return {
    nome_vendedor: dados.seller || '',
    elaborador_proposta: dados.estimator || '',
    cod_prop: dados.proposalCode || '',
    n_rev: dados.revision || '',
    nome_cliente: dados.client || '',
    contato_cliente: dados.contact || '',
    email_cliente: dados.email || '',
    dpto_solicitante: dados.department || '-',
    local_obra: dados.site || '',
    cnpj_texto: dados.cnpj || '',
    prev_atende: dados.attendance || '',
    n_dias: dados.permanence || '',
    dias_treinamento: dados.integration || '',
    n_dias_trabalhados: dados.execution || '',
    dias_mob: dados.mobilization || '',
    adto: dados.advancePercent || '',
    prazo_pgto: dados.paymentTerm || '',
    forma_pgto: dados.paymentMethod || '',
    valor_he: moeda(lerDinheiro(dados.overtimeRate)),
    valor_standby: moeda(lerDinheiro(dados.standbyTeam)),
    diaria_equipamento: moeda(lerDinheiro(dados.standbyEquipment)),
    valor_desmob_extra: moeda(lerDinheiro(dados.extraMobilization)),
    validadeProp: dados.validity || '',
    data_documento: formatarData(dados.date)
  };
}

/**
 * Desdobra a matriz em registros de linha, intercalando o subtítulo da categoria.
 *
 * A categoria é emitida **quando muda**, não a cada linha — é o que faz o
 * documento ter um subtítulo por grupo em vez de um por obrigação. Foi por isso
 * que a categoria virou lista suspensa no formulário: duas grafias da mesma
 * categoria quebrariam o agrupamento aqui, e o documento sairia com "LOGÍSTICA"
 * duas vezes.
 */
function registrosDaMatriz(linhas, sufixo) {
  const categorias = [];
  const itens = [];
  let aberta = null;

  for (const linha of linhas) {
    const categoria = String(linha.categoria || '').trim();
    if (categoria && categoria !== aberta) {
      categorias.push({ [`categoria_${sufixo}`]: categoria, apos: itens.length });
      aberta = categoria;
    }
    itens.push({
      [`escopo_${sufixo}`]: linha.item || '',
      [`nota_${sufixo}`]: linha.note || ''
    });
  }

  return { categorias, itens };
}

/**
 * Preenche uma matriz.
 *
 * As duas linhas-modelo — categoria e item — são clonadas alternadamente na
 * ordem certa, e as duas somem no fim. O `repetirLinha` genérico não serve
 * porque ele repete UMA modelo; aqui são duas, entrelaçadas.
 */
function preencherMatriz(doc, linhas, sufixo) {
  const modeloCategoria = findFirstByText(doc, 'w:tr', `{{categoria_${sufixo}}}`);
  const modeloItem = findFirstByText(doc, 'w:tr', `{{escopo_${sufixo}}}`);
  if (!modeloCategoria || !modeloItem) return;

  const { categorias, itens } = registrosDaMatriz(linhas, sufixo);
  const clones = [];
  let proximaCategoria = 0;

  itens.forEach((item, indice) => {
    while (
      proximaCategoria < categorias.length &&
      categorias[proximaCategoria].apos === indice
    ) {
      const clone = modeloCategoria.cloneNode(true);
      replacePlaceholders(clone, categorias[proximaCategoria]);
      clones.push(clone);
      proximaCategoria += 1;
    }
    const clone = modeloItem.cloneNode(true);
    replacePlaceholders(clone, item);
    clones.push(clone);
  });

  cloneBefore(modeloCategoria, clones);
  removeNode(modeloCategoria);
  removeNode(modeloItem);
}

/** Preenche uma tabela de preços e devolve o total somado. */
function preencherPrecos(doc, itens, sufixo) {
  const registros = itens.map(item => ({
    [`descricao_${sufixo}`]: item.description || '',
    [`unitario_${sufixo}`]: item.unitValue || '',
    [`quantidade_${sufixo}`]: item.quantity || '1',
    [`valor_${sufixo}`]: item.value || ''
  }));

  repetirLinha(doc, `{{descricao_${sufixo}}}`, registros);
  return itens.reduce((soma, item) => soma + lerDinheiro(item.value), 0);
}

export async function preencherProposta(dados, tipo) {
  const modelo = dados.modelo === 'hidrojateamento' ? 'hidrojateamento' : 'padrao';
  const arquivo = arquivoDoModelo(tipo, modelo);
  const zip = new AdmZip(await readFile(path.join(MODELOS, arquivo)));

  const linhas = Array.isArray(dados.rows) ? dados.rows : [];
  const precos = Array.isArray(dados.prices) ? dados.prices : [];
  const locais = tabelasDePrecoDoModelo(modelo);

  for (const parte of PARTES) {
    const item = zip.getEntry(parte);
    if (!item) continue;

    const doc = new DOMParser().parseFromString(
      item.getData().toString('utf8'),
      'text/xml'
    );

    // Tabelas primeiro: elas clonam linhas que ainda têm marcador dentro, e o
    // preenchimento de campo simples depois alcança o que sobrou.
    preencherMatriz(doc, linhas.filter(l => l.owner === 'Filtrovali'), 'filtrovali');
    preencherMatriz(doc, linhas.filter(l => l.owner === 'Contratante'), 'contratante');

    const totais = {};
    if (locais) {
      locais.forEach((local, indice) => {
        const sufixo = indice === 0 ? 'a' : 'b';
        totais[`total_${sufixo}`] = moeda(
          preencherPrecos(doc, precos.filter(p => p.local === local), sufixo)
        );
      });
    } else {
      totais.total_a = moeda(preencherPrecos(doc, precos, 'a'));
    }

    const servicos = (Array.isArray(dados.scopeItems) ? dados.scopeItems : []).map(
      servico => ({
        servico: [servico.title, servico.description].filter(Boolean).join(' — ')
      })
    );
    repetirParagrafo(doc, '{{servico}}', servicos);

    replacePlaceholders(doc.documentElement, { ...camposSimples(dados), ...totais });

    zip.updateFile(parte, Buffer.from(new XMLSerializer().serializeToString(doc), 'utf8'));
  }

  return zip.toBuffer();
}
