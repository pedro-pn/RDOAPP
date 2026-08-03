import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Rastreabilidade requisito → tarefa do módulo Comercial.
 *
 * O problema que este teste resolve: durante um porte de ~11 semanas, alguém
 * acrescenta um requisito ao spec.md e esquece de criar a tarefa. Ninguém
 * percebe, porque requisito sem tarefa não gera erro — só não acontece.
 *
 * Conferi essa cobertura à mão uma vez, no /speckit-analyze. O resultado
 * envelheceu no mesmo dia, porque o spec cresceu de 48 para 78 requisitos.
 * Por isso virou teste: conferência manual não sobrevive ao próximo commit.
 *
 * Este teste NÃO prova que a tarefa faz a coisa certa — prova que o requisito
 * tem dono. É o mínimo verificável por máquina.
 */

const here = dirname(fileURLToPath(import.meta.url));
const featureDir = join(here, '../../specs/009-modulo-comercial');
const spec = readFileSync(join(featureDir, 'spec.md'), 'utf8');
const tasks = readFileSync(join(featureDir, 'tasks.md'), 'utf8');

/**
 * Requisitos deliberadamente sem tarefa, com o motivo.
 * Acrescentar aqui é uma decisão consciente, não um atalho para o teste passar.
 */
const SEM_TAREFA = {
  'SC-007':
    'Critério de observação de uso ("conclui um levantamento sem ajuda externa"). ' +
    'Não é construível: verifica-se observando gente usando, depois do go-live.',
};

function idsDeclaradosNoSpec(prefixo) {
  const encontrados = new Set();
  const padrao = new RegExp(`^- \\*\\*(${prefixo}-\\d+[a-z]?)\\*\\*:`, 'gm');
  for (const match of spec.matchAll(padrao)) encontrados.add(match[1]);
  return [...encontrados].sort();
}

function idsCitadosNasTarefas(prefixo) {
  const encontrados = new Set();
  // `[X]` e `[x]` valem: quem marca a tarefa como feita não deve conseguir
  // esconder o requisito dela de quebra. Este teste já perdeu 14 requisitos de
  // vista por causa dessa letra.
  const padrao = new RegExp('^- \\[[ xX]\\] T\\d+[a-z]? .*$', 'gm');
  for (const linha of tasks.match(padrao) || []) {
    for (const ref of linha.matchAll(new RegExp(`\`(${prefixo}-\\d+[a-z]?)\``, 'g'))) {
      encontrados.add(ref[1]);
    }
  }
  return encontrados;
}

for (const prefixo of ['FR', 'SC']) {
  test(`todo ${prefixo} do spec.md tem pelo menos uma tarefa`, () => {
    const declarados = idsDeclaradosNoSpec(prefixo);
    assert.ok(declarados.length > 0, `nenhum ${prefixo} encontrado no spec.md`);

    const citados = idsCitadosNasTarefas(prefixo);
    const orfaos = declarados.filter(
      (id) => !citados.has(id) && !(id in SEM_TAREFA),
    );

    assert.deepEqual(
      orfaos,
      [],
      `Requisito sem tarefa que o cubra: ${orfaos.join(', ')}.\n` +
        'Ou crie a tarefa em tasks.md citando o identificador entre crases, ' +
        'ou registre a ausência em SEM_TAREFA com o motivo.',
    );
  });
}

test('as tarefas não citam requisito que não existe no spec.md', () => {
  const declarados = new Set([
    ...idsDeclaradosNoSpec('FR'),
    ...idsDeclaradosNoSpec('SC'),
  ]);
  const citados = [
    ...idsCitadosNasTarefas('FR'),
    ...idsCitadosNasTarefas('SC'),
  ];
  const fantasmas = citados.filter((id) => !declarados.has(id)).sort();

  assert.deepEqual(
    fantasmas,
    [],
    `Tarefa aponta para requisito inexistente: ${fantasmas.join(', ')}. ` +
      'Provavelmente o requisito foi renumerado ou removido do spec.md.',
  );
});

test('as ausências declaradas continuam justificadas', () => {
  const declarados = new Set([
    ...idsDeclaradosNoSpec('FR'),
    ...idsDeclaradosNoSpec('SC'),
  ]);
  for (const [id, motivo] of Object.entries(SEM_TAREFA)) {
    assert.ok(
      declarados.has(id),
      `${id} está em SEM_TAREFA mas não existe mais no spec.md — remova a exceção.`,
    );
    assert.ok(motivo.length > 40, `${id}: o motivo precisa dizer por quê.`);
  }
});
