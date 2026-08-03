#!/usr/bin/env node
/**
 * Semeia a numeração de propostas do módulo Comercial.
 *
 * Roda **uma vez por ambiente**, manualmente, antes da primeira proposta. Enquanto
 * não rodar, `GET /api/comercial/propostas/proximo-numero` responde `503` — o módulo
 * recusa emitir em vez de arriscar um código repetido no documento do cliente.
 *
 * Sem argumento, apenas **relata**: mostra o maior número que encontrou e o que
 * gravaria, sem gravar nada. Para gravar de verdade é preciso `--aplicar`.
 *
 *   node scripts/semear-numeracao-comercial.mjs
 *   node scripts/semear-numeracao-comercial.mjs --aplicar
 *   node scripts/semear-numeracao-comercial.mjs --aplicar --numero 4500
 *
 * O piso vem de `CommercialProposal.codProp` — a tabela importada do Access. **Só dessa
 * coluna.**
 *
 * `codNectar` fica de fora de propósito, e a primeira versão deste script errou nisso:
 * ele parece um número de proposta e não é. É o identificador do registro no CRM, de
 * outro espaço de numeração inteiro — neste banco o maior `codProp` é 4.434 e o maior
 * `codNectar` passa de 292 milhões. Somar os dois num `max()` faria a primeira proposta
 * do módulo nascer com nove dígitos.
 *
 * Ainda assim, **confira o CRM antes de aplicar**: a importação do Access pode estar
 * defasada em relação ao número que o Nectar já emitiu. Havendo número maior lá,
 * informe-o com `--numero`.
 */

import prisma from '../src/lib/prisma.js';
import { numberingStatus, seedNumbering } from '../src/lib/comercial/numbering.js';

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const indiceNumero = args.indexOf('--numero');
const numeroManual = indiceNumero >= 0 ? Number(args[indiceNumero + 1]) : null;

async function maiorNumeroConhecido() {
  const [agregado, examinadas] = await Promise.all([
    prisma.commercialProposal.aggregate({ _max: { codProp: true } }),
    prisma.commercialProposal.count()
  ]);

  return { maior: agregado._max.codProp || 0, examinadas };
}

async function main() {
  const estado = await numberingStatus(prisma);
  if (estado.seeded) {
    console.log(
      `Numeração JÁ SEMEADA em ${estado.seededAt.toISOString()} ` +
        `(partiu de ${estado.seedValue}). Nada a fazer.`
    );
    return;
  }

  const { maior, examinadas } = await maiorNumeroConhecido();
  const proximo = numeroManual || maior + 1;

  console.log(`CommercialProposal examinadas: ${examinadas}`);
  console.log(`Maior codProp (o número da proposta): ${maior || '(nenhum)'}`);
  if (numeroManual) console.log(`Número informado na linha de comando: ${numeroManual}`);
  console.log(`Próximo número a emitir: ${proximo}`);

  if (!aplicar) {
    console.log('\nRelatório apenas. Rode de novo com --aplicar para gravar.');
    console.log(
      'ATENÇÃO: confira o CRM Nectar antes. A importação do Access pode estar defasada.'
    );
    return;
  }

  await seedNumbering(prisma, { proximoNumero: proximo, rotulo: 'script' });
  console.log(`\nSemeado. A próxima proposta receberá o número ${proximo}.`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
