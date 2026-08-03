import { ComercialError } from './cost-estimates.js';

/**
 * Consultores de vendas do módulo Comercial (tarefas T099 a T101).
 *
 * **Não há cadastro de vendedor.** A decisão 12.5.1 do mantenedor unificou vendedor e
 * usuário: todo consultor de vendas tem conta no app, então a lista é *derivada* dos
 * usuários com o papel `comercial:seller` ou `comercial:manager`. Some o model, some o
 * CRUD, some a tela de cadastro — e some a classe inteira de defeito em que a lista de
 * vendedores diverge da lista de contas.
 *
 * **A resposta varia por papel** (FR-041b), e isso é restrição, não conveniência:
 *
 * - `comercial:manager` recebe todos, porque emite proposta em nome de qualquer um;
 * - `comercial:seller` recebe **só a si mesmo**, já pré-selecionado. Ele não escolhe
 *   em nome de quem vende;
 * - `comercial:viewer` não chega aqui — a rota exige orçamentista.
 */

const PAPEIS_DE_VENDA = ['COMERCIAL_SELLER', 'COMERCIAL_MANAGER'];

function ehGestor(usuario) {
  return (usuario?.moduleRoles || []).some(
    papel => papel.module === 'COMERCIAL' && papel.role === 'COMERCIAL_MANAGER'
  );
}

function paraConsultor(usuario) {
  return {
    id: usuario.id,
    nome: usuario.name || usuario.username,
    username: usuario.username
  };
}

/**
 * A lista que o usuário pode ver.
 *
 * O vendedor recebe **um** item mesmo tendo a conta desativada por outra via: a fonte
 * aqui é a sessão dele, não a consulta. Um vendedor ativo o bastante para estar logado
 * é ativo o bastante para constar da própria proposta.
 */
export async function listarConsultores(prismaClient, usuario) {
  if (!ehGestor(usuario)) {
    return { items: [paraConsultor(usuario)], podeEscolher: false };
  }

  const usuarios = await prismaClient.user.findMany({
    where: {
      isActive: true,
      moduleRoles: { some: { module: 'COMERCIAL', role: { in: PAPEIS_DE_VENDA } } }
    },
    select: { id: true, name: true, username: true },
    orderBy: [{ name: 'asc' }, { username: 'asc' }]
  });

  return { items: usuarios.map(paraConsultor), podeEscolher: true };
}

/**
 * Resolve quem será gravado como consultor da proposta.
 *
 * O nome vai gravado junto com o id (T101) porque ele é o do **momento da emissão**.
 * Desativar ou renomear a conta depois não pode reescrever a proposta que já foi ao
 * cliente — o documento impresso diz um nome, e o sistema tem de dizer o mesmo.
 */
export async function resolverConsultor(prismaClient, usuario, sellerUserId) {
  if (!ehGestor(usuario)) {
    // Vendedor só emite em nome próprio. Mandar outro id é tentativa de burlar,
    // não engano de interface — e recusar é mais honesto que ignorar em silêncio.
    if (sellerUserId && sellerUserId !== usuario.id) {
      throw new ComercialError(
        'Vendedor só pode emitir proposta em nome próprio.',
        403
      );
    }
    return { sellerUserId: usuario.id, sellerName: usuario.name || usuario.username };
  }

  if (!sellerUserId) {
    throw new ComercialError('Selecione o consultor de vendas.', 422);
  }

  const escolhido = await prismaClient.user.findFirst({
    where: {
      id: sellerUserId,
      isActive: true,
      moduleRoles: { some: { module: 'COMERCIAL', role: { in: PAPEIS_DE_VENDA } } }
    },
    select: { id: true, name: true, username: true }
  });

  if (!escolhido) {
    throw new ComercialError(
      'O consultor selecionado não está ativo no módulo Comercial.',
      422
    );
  }

  return { sellerUserId: escolhido.id, sellerName: escolhido.name || escolhido.username };
}
