import assert from 'node:assert/strict';
import test from 'node:test';

import { listarConsultores, resolverConsultor } from '../src/lib/comercial/consultores.js';

/**
 * Consultores de vendas (tarefas T099 a T101).
 *
 * A decisão 12.5.1 unificou vendedor e usuário: a lista é derivada das contas, não
 * cadastrada. O que precisa ser provado aqui é a **variação por papel**, que é
 * restrição de acesso e não conveniência de tela.
 */

function usuario({ id = 'u1', name = 'Ana', gestor = false } = {}) {
  return {
    id,
    name,
    username: name.toLowerCase(),
    moduleRoles: [
      {
        module: 'COMERCIAL',
        role: gestor ? 'COMERCIAL_MANAGER' : 'COMERCIAL_SELLER'
      }
    ]
  };
}

function prismaFalso(usuarios = []) {
  const consultas = [];
  return {
    consultas,
    user: {
      findMany: async args => {
        consultas.push(args);
        return usuarios;
      },
      findFirst: async args => {
        consultas.push(args);
        return usuarios.find(u => u.id === args.where.id) || null;
      }
    }
  };
}

test('vendedor recebe SÓ a si mesmo, e nem consulta o banco', async () => {
  // Ele não escolhe em nome de quem vende. Consultar e depois filtrar seria
  // trazer para a memória do processo uma lista que ele não pode ver.
  const prisma = prismaFalso([usuario({ id: 'outro', name: 'Bruno' })]);
  const resultado = await listarConsultores(prisma, usuario({ id: 'u1', name: 'Ana' }));

  assert.equal(resultado.items.length, 1);
  assert.equal(resultado.items[0].id, 'u1');
  assert.equal(resultado.podeEscolher, false);
  assert.equal(prisma.consultas.length, 0, 'não deve consultar o banco');
});

test('gestor recebe a lista completa', async () => {
  const prisma = prismaFalso([
    usuario({ id: 'u1', name: 'Ana' }),
    usuario({ id: 'u2', name: 'Bruno' })
  ]);
  const resultado = await listarConsultores(prisma, usuario({ id: 'g1', gestor: true }));

  assert.equal(resultado.items.length, 2);
  assert.equal(resultado.podeEscolher, true);
});

test('a consulta pede apenas contas ATIVAS com papel de venda', async () => {
  const prisma = prismaFalso([]);
  await listarConsultores(prisma, usuario({ gestor: true }));

  const where = prisma.consultas[0].where;
  assert.equal(where.isActive, true);
  assert.deepEqual(where.moduleRoles.some.role.in, ['COMERCIAL_SELLER', 'COMERCIAL_MANAGER']);
});

test('vendedor mandando o id de outro é RECUSADO, não ignorado', async () => {
  // Ignorar em silêncio esconderia a tentativa; recusar deixa rastro.
  const prisma = prismaFalso([]);
  await assert.rejects(
    () => resolverConsultor(prisma, usuario({ id: 'u1' }), 'u2'),
    error => {
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
});

test('vendedor sem escolha nenhuma resolve para si mesmo', async () => {
  const resolvido = await resolverConsultor(prismaFalso([]), usuario({ id: 'u1', name: 'Ana' }), '');
  assert.deepEqual(resolvido, { sellerUserId: 'u1', sellerName: 'Ana' });
});

test('o nome é gravado junto com o id', async () => {
  // T101: o nome é o do MOMENTO DA EMISSÃO. Renomear a conta depois não pode
  // reescrever a proposta que já foi ao cliente — o papel impresso diz um nome.
  const prisma = prismaFalso([usuario({ id: 'u2', name: 'Bruno' })]);
  const resolvido = await resolverConsultor(prisma, usuario({ gestor: true }), 'u2');

  assert.deepEqual(resolvido, { sellerUserId: 'u2', sellerName: 'Bruno' });
});

test('gestor escolhendo consultor inativo recebe 422 com motivo', async () => {
  const prisma = prismaFalso([]);
  await assert.rejects(
    () => resolverConsultor(prisma, usuario({ gestor: true }), 'sumido'),
    error => {
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /não está ativo/);
      return true;
    }
  );
});

test('gestor sem escolher nada recebe 422, não um padrão silencioso', async () => {
  // Preencher com o próprio gestor seria atribuir a venda a quem não vendeu.
  await assert.rejects(
    () => resolverConsultor(prismaFalso([]), usuario({ gestor: true }), ''),
    error => {
      assert.equal(error.statusCode, 422);
      return true;
    }
  );
});
