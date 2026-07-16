/*
 * Diagnóstico da folha de um colaborador num mês: mostra os parâmetros (campos amarelos) e os inputs
 * do motor (Simulador) usados, além do detalhamento, para conferir com a planilha custo_operador/auxiliar.
 *
 * Uso:  node scripts/debug-folha.js "Adailton" 2026-06
 */

import { debugCollaboratorMonth } from '../src/lib/acompanhamento/labor-cost.js';
import prisma from '../src/lib/prisma.js';

const [nameQuery = 'Adailton', monthKey = '2026-06'] = process.argv.slice(2);
const brl = v => (typeof v === 'number' ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => `${((v || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const r = await debugCollaboratorMonth(nameQuery, monthKey);
const p = r.params;
const b = r.breakdown;
const ben = p.beneficios || {};

console.log(`\n=== ${r.name} — cargo ${r.role} — mês ${r.monthKey} ===`);
console.log(`Cobertura do mês no arquivo: ${(r.fixedCoverage * 100).toFixed(1)}% (1 = mês cheio)`);

console.log('\n--- Campos amarelos (Parâmetros) ---');
console.log('Salário base:            ', brl(p.salarioBase));
console.log('Insalubridade:           ', brl(p.insalubridade));
console.log('Carga horária mensal:    ', p.cargaHoraria);
console.log('Dias úteis:              ', p.diasUteis);
console.log('Periculosidade:          ', pct(p.periculosidadePct));
console.log('Produtividade:           ', pct(p.produtividadePct));
console.log('Transferência:           ', pct(p.transferenciaPct));
console.log('HE 70% / 100%:           ', pct(p.he70Pct), '/', pct(p.he100Pct));
console.log('FGTS:                    ', pct(p.fgtsPct));
console.log('Benefícios:              ', `plano ${brl(ben.planoSaude)} · VA ${brl(ben.valeAlimentacao)} · odonto ${brl(ben.odonto)} · seguro ${brl(ben.seguroVida)} · cursos ${brl(ben.cursos)}`);

console.log('\n--- Simulador Mensal (inputs deste mês) ---');
console.log('Dias em cliente (periculosidade):', r.inputs.diasCliente.toFixed(2));
console.log('Dias dormindo fora (viagem):     ', r.inputs.diasFora.toFixed(2), r.inputs.offshoreDays ? `(+ ${r.inputs.offshoreDays.toFixed(2)} offshore)` : '');
console.log('Dias dormindo em casa (produtiv.):', r.inputs.diasCasa.toFixed(2));
console.log('Horas extras 70%:                ', r.inputs.he70Horas.toFixed(2) + 'h');
console.log('Horas extras 100%:               ', r.inputs.he100Horas.toFixed(2) + 'h');
console.log('(Folga no mês, só no denominador do HH):', r.folgaHours.toFixed(1) + 'h');

console.log('\n--- Detalhamento do motor ---');
console.log('Periculosidade:      ', brl(b.periculosidade));
console.log('Produtividade:       ', brl(b.produtividade));
console.log('Transferência:       ', brl(b.transferencia));
console.log('HE 70% / 100% / DSR: ', brl(b.he70), '/', brl(b.he100), '/', brl(b.dsr));
console.log('Remuneração bruta:   ', brl(b.remuneracaoBruta));
console.log('Encargos (FGTS):     ', brl(b.encargos));
console.log('Provisões (13º+férias+FGTS):', brl(b.provisoes));
console.log('Benefícios:          ', brl(b.beneficios));
console.log('Passivo rescisório (aviso):', brl(b.passivoRescisorio));
console.log('CUSTO TOTAL MENSAL (planilha):', brl(b.totalMensal));
console.log('+ EPI/mês:           ', brl(r.epiMensal));

console.log('\n--- Folha no app ---');
console.log('Fixo (× cobertura):  ', brl(r.fixoMensal));
console.log('Variável:            ', brl(r.variavelMensal));
console.log('FOLHA (app):         ', brl(r.folha));
console.log('Custo/hora ≈ folha ÷ (horas ponto + folga do mês)\n');

await prisma.$disconnect();
