import { hasModuleRole } from '../module-roles.js';

/**
 * Controle de acesso do módulo Comercial — autoria e visibilidade de valores.
 *
 * Existe porque **middleware de papel não basta**. O middleware sabe o papel do
 * usuário; não sabe de quem é o registro que ele está pedindo. Um
 * `comercial:seller` passa por `requireComercialEstimator` e, sem isto aqui,
 * alcança o levantamento de qualquer colega.
 *
 * Dois erros que este módulo existe para evitar:
 *
 * 1. **Proteger só a rota de item.** `GET /levantamentos/:id` nega, e o índice
 *    devolve tudo. É o vazamento mais provável e o menos visível, porque a tela
 *    do vendedor "funciona" — só mostra demais.
 *
 * 2. **Esconder valores na tela.** Um `totalValue` que chega ao navegador e é
 *    ocultado por CSS está visível para quem abrir as ferramentas do navegador.
 *    A supressão acontece aqui, na serialização.
 *
 * Papéis (§12.5.1 do docs/PLANO_MODULO_COMERCIAL.md):
 *
 *   comercial:manager  alcança tudo; edita e finaliza qualquer registro
 *   comercial:seller   alcança apenas o que é seu
 *   comercial:viewer   somente leitura, e sem ver valor nenhum
 */

export const ROLE_MANAGER = 'comercial:manager';
export const ROLE_SELLER = 'comercial:seller';
export const ROLE_VIEWER = 'comercial:viewer';

export function isManager(user) {
  return Boolean(user) && hasModuleRole(user, ROLE_MANAGER);
}

export function isSeller(user) {
  return Boolean(user) && hasModuleRole(user, ROLE_SELLER);
}

/** Gestor ou vendedor. É quem alcança levantamento de custos. */
export function isEstimator(user) {
  return isManager(user) || isSeller(user);
}

/**
 * Vê valor, custo e margem?
 *
 * Gestor e vendedor sim; consulta nunca. O vendedor só vê os valores **do que é
 * dele** — isso é autoria, resolvida em `canRead`, não aqui.
 */
export function canViewValues(user) {
  return isEstimator(user);
}

/**
 * Filtro de autoria para LISTAGEM.
 *
 * Devolve o pedaço de `where` que restringe o alcance. Gestor recebe `{}`;
 * vendedor recebe o filtro por autoria.
 *
 * **Toda listagem do módulo tem de aplicar isto.** É aqui que o vazamento entre
 * vendedores aconteceria, e é o caso que o teste de permissão cobre.
 */
export function authorshipFilter(user) {
  if (isManager(user)) return {};
  if (isSeller(user)) return { createdByUserId: user.id };
  // Consulta não alcança levantamento por nenhum caminho; para propostas, o
  // chamador aplica a supressão de valores em vez deste filtro.
  return { createdByUserId: '__sem_acesso__' };
}

/**
 * O usuário pode LER este registro?
 * `record` precisa ter `createdByUserId`.
 */
export function canRead(user, record) {
  if (!record) return false;
  if (isManager(user)) return true;
  if (isSeller(user)) return record.createdByUserId === user.id;
  return false;
}

/**
 * O usuário pode ESCREVER neste registro?
 *
 * Vale para levantamento **e** proposta — a regra de autoria alcança as duas
 * entidades, não só a proposta (FR-029).
 */
export function canWrite(user, record) {
  if (!record) return false;
  if (isManager(user)) return true;
  if (isSeller(user)) return record.createdByUserId === user.id;
  return false;
}

/**
 * O usuário pode FINALIZAR esta proposta?
 *
 * O autor finaliza a sua; o gestor finaliza qualquer uma. Sem isso, toda
 * proposta de vendedor ficaria parada esperando um gestor apertar o botão.
 */
export function canFinalize(user, proposal) {
  return canWrite(user, proposal);
}

/** Arquivar segue a mesma regra de escrita (FR-061). Não existe exclusão. */
export function canArchive(user, record) {
  return canWrite(user, record);
}

/**
 * Motivo da negativa, para a resposta HTTP.
 * Vendedor pedindo registro de outro autor recebe **403**, não `404` genérico
 * nem tela vazia — esconder que existe não é a política aqui, e um 404 mentiria.
 */
export function denialReason(user, record) {
  if (!isEstimator(user)) return 'Acesso restrito a orçamentistas do Comercial.';
  if (record && record.createdByUserId !== user.id) {
    return 'Este registro pertence a outro orçamentista.';
  }
  return 'Acesso negado.';
}

const VALUE_FIELDS = [
  'totalValue',
  'totalCost',
  'salePrice',
  'marginPercent',
  'margin',
  'cost',
  'commissionBps'
];

/**
 * Remove valor, custo e margem de um registro serializado, para o papel de
 * consulta.
 *
 * **Omite na origem, não esconde na tela.** Chamar isto antes de responder é o
 * que torna o FR-030 verdadeiro; ocultar no cliente deixaria o número no JSON.
 */
export function stripValues(record) {
  if (!record || typeof record !== 'object') return record;
  const clean = { ...record };
  for (const field of VALUE_FIELDS) delete clean[field];
  return clean;
}

/**
 * Serializa um registro respeitando o papel de quem pede.
 * Use sempre que a resposta puder alcançar `comercial:viewer`.
 */
export function serializeForUser(user, record) {
  return canViewValues(user) ? record : stripValues(record);
}

export function serializeListForUser(user, records) {
  if (canViewValues(user)) return records;
  return records.map(stripValues);
}

/**
 * O papel de consulta pode baixar este documento?
 *
 * Só a técnica. A comercial traz tabela de preços, condições de pagamento e
 * valor total — liberá-la contornaria a restrição de valores por outra porta,
 * e a restrição deixaria de valer para qualquer um com o link.
 */
export function canDownloadDocument(user, document) {
  if (!document) return false;
  if (canViewValues(user)) return true;
  return document.kind === 'TECNICA';
}
