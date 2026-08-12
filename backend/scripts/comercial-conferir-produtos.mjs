/**
 * Confere o mapa serviço → produto contra o catálogo real do Nectar.
 *
 * **Só leitura.** Existe porque o `codigo` FV-nn do Nectar **se desloca** quando
 * o catálogo é editado — "passagem de PIG" foi FV-27 e virou FV-26 com o mesmo
 * `id`. O mapa amarra pelo `id`, que é estável, mas o produto pode ser
 * desativado ou renomeado, e aí a finalização passaria a mandar a proposta para
 * a categoria errada **sem erro nenhum**.
 *
 * Rode depois de qualquer mexida no catálogo do CRM:
 *
 *     NECTAR_MODE=real node scripts/comercial-conferir-produtos.mjs
 */
import env from '../src/config/env.js';
import { PRODUTO_POR_SERVICO } from '../src/lib/comercial/nectar-produtos.js';

if (!env.nectarApiToken) {
  console.error('NECTAR_API_TOKEN não configurado.');
  process.exit(1);
}

const resposta = await fetch(
  'https://app.nectarcrm.com.br/crm/api/1/produtos?page=1&displayLength=100',
  { headers: { 'Access-Token': env.nectarApiToken }, signal: AbortSignal.timeout(25000) }
);

if (!resposta.ok) {
  console.error(`O Nectar respondeu ${resposta.status} ao listar produtos.`);
  process.exit(1);
}

const catalogo = new Map(
  (await resposta.json()).map(produto => [String(produto.id), produto])
);

let problemas = 0;

for (const [servico, esperado] of Object.entries(PRODUTO_POR_SERVICO)) {
  if (!esperado) {
    console.log(`?  ${servico.padEnd(36)} sem produto mapeado`);
    problemas += 1;
    continue;
  }

  const atual = catalogo.get(String(esperado.id));

  if (!atual) {
    console.log(`X  ${servico.padEnd(36)} id ${esperado.id} NÃO EXISTE mais no catálogo`);
    problemas += 1;
    continue;
  }
  if (atual.ativo === false) {
    console.log(`X  ${servico.padEnd(36)} "${atual.nome}" está DESATIVADO`);
    problemas += 1;
    continue;
  }
  if (atual.nome !== esperado.nome) {
    console.log(`!  ${servico.padEnd(36)} renomeado: "${esperado.nome}" -> "${atual.nome}"`);
    problemas += 1;
    continue;
  }
  if (String(atual.codigo) !== esperado.codigo) {
    // Só legenda: o mapa não depende disso, mas vale saber que envelheceu.
    console.log(`~  ${servico.padEnd(36)} código mudou: ${esperado.codigo} -> ${atual.codigo}`);
    continue;
  }

  console.log(`ok ${servico.padEnd(36)} ${atual.codigo} ${atual.nome}`);
}

console.log(
  problemas
    ? `\n${problemas} problema(s). O mapa em nectar-produtos.js precisa de revisão.`
    : '\nO mapa bate com o catálogo.'
);
process.exit(problemas ? 1 : 0);
