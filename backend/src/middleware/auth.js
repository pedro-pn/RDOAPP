import asyncHandler from '../lib/async-handler.js';
import { hashToken, publicUser } from '../lib/auth.js';
import { trustedClientAccessScopeForUser } from '../lib/client-project-access.js';
import { AccountTypes, hasModuleRole, publicModuleRolesForAccountType, publicModuleRolesForModule } from '../lib/module-roles.js';
import {
  CLIENT_PRIVACY_NOTICE_VERSION,
  clientPrivacyConsentRequired,
  isClientPrivacyConsentAllowedRoute
} from '../lib/privacy-consent.js';
import prisma from '../lib/prisma.js';

export const RDO_INTERNAL_ROLES = publicModuleRolesForModule('rdo', { includeClient: false });
export const RDO_ACCESS_ROLES = publicModuleRolesForModule('rdo');
export const EQUIPAMENTOS_ACCESS_ROLES = publicModuleRolesForModule('equipamentos');
export const ESTOQUE_ACCESS_ROLES = publicModuleRolesForModule('estoque');
export const ACOMPANHAMENTO_ACCESS_ROLES = publicModuleRolesForModule('acompanhamento');
export const QUALIDADE_ACCESS_ROLES = publicModuleRolesForModule('qualidade');
export const COMERCIAL_ACCESS_ROLES = publicModuleRolesForModule('comercial');
// Quem levanta custo: gestor e vendedor. O papel de consulta NÃO entra —
// custo e margem não aparecem para ele em nenhuma superfície (§12.5.1).
export const COMERCIAL_ESTIMATOR_ROLES = ['comercial:manager', 'comercial:seller'];
export const INTERNAL_ACCOUNT_ROLES = Array.from(new Set([
  ...publicModuleRolesForAccountType(AccountTypes.ADMIN),
  ...publicModuleRolesForAccountType(AccountTypes.INTERNAL)
]));
export const ROMANEIO_ACCESS_ROLES = publicModuleRolesForModule('romaneio');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findSessionWithRetry(tokenHash, options = {}) {
  const attempts = options.attempts || 3;
  const delayMs = options.delayMs || 25;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.userSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              collaborator: true,
              moduleRoles: true
            }
          }
        }
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sessao ausente.' });
  }

  const session = await findSessionWithRetry(hashToken(token));

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  const user = publicUser(session.user);
  const trustedClientScope = await trustedClientAccessScopeForUser(prisma, session.user);

  req.auth = {
    token,
    sessionId: session.id,
    user: trustedClientScope.emails.length || trustedClientScope.cnpjs.length
      ? { ...user, trustedClientEmails: trustedClientScope.emails, trustedClientCnpjs: trustedClientScope.cnpjs }
      : user,
    rawUser: session.user
  };

  if (clientPrivacyConsentRequired(session.user) && !isClientPrivacyConsentAllowedRoute(req)) {
    return res.status(428).json({
      error: 'Aceite a política de privacidade para continuar.',
      code: 'CLIENT_PRIVACY_CONSENT_REQUIRED',
      privacyPolicyVersion: CLIENT_PRIVACY_NOTICE_VERSION
    });
  }

  next();
});

export function requireManager(req, res, next) {
  if (!req.auth || req.auth.user.accountType !== 'ADMIN' || !hasModuleRole(req.auth.user, 'rdo:manager')) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  next();
}

export function requireHubAdmin(req, res, next) {
  if (!req.auth || req.auth.user.accountType !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  next();
}

export function requireInternalUser(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, RDO_INTERNAL_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito a usuários internos.' });
  }

  next();
}

export function requireAnyInternalAccount(req, res, next) {
  if (!req.auth || req.auth.user.accountType === 'CLIENT') {
    return res.status(403).json({ error: 'Acesso restrito a contas internas.' });
  }

  next();
}

export function requireModuleRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !hasModuleRole(req.auth.user, roles)) {
      return res.status(403).json({ error: 'Acesso restrito ao módulo.' });
    }

    next();
  };
}

export function requireEquipamentosAccess(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, EQUIPAMENTOS_ACCESS_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito ao módulo Equipamentos.' });
  }

  next();
}

export function requireEquipamentosManager(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, 'equipamentos:manager')) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor de Equipamentos.' });
  }

  next();
}

export function requireEstoqueAccess(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, ESTOQUE_ACCESS_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito ao módulo Estoque.' });
  }

  next();
}

export function requireEstoqueManager(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, 'estoque:manager')) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor de Estoque.' });
  }

  next();
}

export function requireQualidadeAccess(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, QUALIDADE_ACCESS_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito ao módulo Qualidade.' });
  }

  next();
}

export function requireQualidadeManager(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, 'qualidade:manager')) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor de Qualidade.' });
  }

  next();
}

// Acompanhamento: admin do hub OU papel do módulo (mantém admins com acesso).
export function requireAcompanhamentoAccess(req, res, next) {
  if (!req.auth || (req.auth.user.accountType !== 'ADMIN' && !hasModuleRole(req.auth.user, ACOMPANHAMENTO_ACCESS_ROLES))) {
    return res.status(403).json({ error: 'Acesso restrito ao módulo Acompanhamento.' });
  }

  next();
}

export function requireAcompanhamentoManager(req, res, next) {
  if (!req.auth || (req.auth.user.accountType !== 'ADMIN' && !hasModuleRole(req.auth.user, 'acompanhamento:manager'))) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor de Acompanhamento.' });
  }

  next();
}

// Gestor do módulo Acompanhamento? (ADMIN ou papel acompanhamento:manager) — para gate de dados
// sensíveis (custo/salário) em endpoints acessíveis a visualizadores.
export function isAcompanhamentoManager(user) {
  return Boolean(user) && (user.accountType === 'ADMIN' || hasModuleRole(user, 'acompanhamento:manager'));
}

// Usuário que pode ver os custos de mão de obra calculados no Acompanhamento.
// Configuração de parâmetros continua restrita ao gestor; esta permissão é só leitura operacional.
export function canViewAcompanhamentoLaborCosts(user) {
  return Boolean(user) && (user.accountType === 'ADMIN' || hasModuleRole(user, ACOMPANHAMENTO_ACCESS_ROLES));
}

// ---------------------------------------------------------------------------
// Comercial — três papéis (§12.5.1 do docs/PLANO_MODULO_COMERCIAL.md)
//
//   comercial:manager  Gestor    alcança tudo; edita e finaliza qualquer uma
//   comercial:seller   Vendedor  cria; alcança apenas o que é seu
//   comercial:viewer   Consulta  somente leitura, e sem ver valores
//
// ATENÇÃO: middleware de papel NÃO basta. Ele sabe o papel, não sabe a autoria
// do registro alcançado. Toda rota que toca um registro específico precisa
// passar também pela verificação de autoria (lib/comercial/access.js), e toda
// listagem precisa filtrar por autoria quando o solicitante é vendedor — é ali
// que o vazamento entre vendedores acontece, não na rota de item.
// ---------------------------------------------------------------------------

export function requireComercialAccess(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, COMERCIAL_ACCESS_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito ao módulo Comercial.' });
  }

  next();
}

// Gestor OU vendedor. É o gate do levantamento de custos e da criação de propostas.
export function requireComercialEstimator(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, COMERCIAL_ESTIMATOR_ROLES)) {
    return res.status(403).json({ error: 'Acesso restrito a orçamentistas do Comercial.' });
  }

  next();
}

export function requireComercialManager(req, res, next) {
  if (!req.auth || !hasModuleRole(req.auth.user, 'comercial:manager')) {
    return res.status(403).json({ error: 'Acesso restrito ao gestor do Comercial.' });
  }

  next();
}

// Gestor do Comercial? Alcança registro de qualquer autor.
export function isComercialManager(user) {
  return Boolean(user) && hasModuleRole(user, 'comercial:manager');
}

// Pode ver custo, margem e valor? Gestor e vendedor sim; consulta nunca.
// O vendedor só vê os valores do que é dele — isso é autoria, resolvida em
// lib/comercial/access.js, não aqui.
export function canViewComercialValues(user) {
  return Boolean(user) && hasModuleRole(user, COMERCIAL_ESTIMATOR_ROLES);
}
