import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

function emptyToUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function requiredString(name) {
  return z.preprocess(
    emptyToUndefined,
    z.string({
      required_error: `${name} deve ser configurado.`,
      invalid_type_error: `${name} deve ser texto.`
    }).min(1, `${name} deve ser configurado.`)
  );
}

function stringWithDefault(defaultValue = '') {
  return z.preprocess(emptyToUndefined, z.string().default(defaultValue));
}

function integerWithDefault(name, defaultValue, { min, max } = {}) {
  let schema = z.number({
    invalid_type_error: `${name} deve ser numerico.`
  }).int(`${name} deve ser inteiro.`);
  if (min !== undefined) schema = schema.min(min, `${name} deve ser maior ou igual a ${min}.`);
  if (max !== undefined) schema = schema.max(max, `${name} deve ser menor ou igual a ${max}.`);

  return z.preprocess(value => {
    const normalized = emptyToUndefined(value);
    return normalized === undefined ? defaultValue : Number(normalized);
  }, schema);
}

function booleanWithDefault(name, defaultValue) {
  return z.preprocess(value => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return defaultValue;
    const lower = String(normalized).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
    if (['0', 'false', 'no', 'off'].includes(lower)) return false;
    return normalized;
  }, z.boolean({ invalid_type_error: `${name} deve ser booleano (true/false).` }));
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function parseTrustProxy(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(lower)) return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (['true', 'yes', 'on'].includes(lower)) return true;
  return raw;
}

export function assertProductionTrustProxyConfigured({ nodeEnv, trustProxyConfigured, trustProxy = false }) {
  if (nodeEnv !== 'production') return;
  if (!trustProxyConfigured) {
    throw new Error('TRUST_PROXY deve ser configurado explicitamente em produção. Use false apenas se o backend não estiver atrás de proxy.');
  }
  if (trustProxy === true) {
    throw new Error('TRUST_PROXY=true é inseguro em produção. Configure false, um hop count numérico ou uma lista explícita de proxies/CIDRs.');
  }
}

export function assertProductionSignatureTokenSecretConfigured({ nodeEnv, signatureTokenSecret }) {
  if (nodeEnv !== 'production') return;
  if (!signatureTokenSecret) {
    throw new Error('SIGNATURE_TOKEN_SECRET deve ser configurado explicitamente em produção.');
  }
}

export function assertProductionSurveyTokenSecretConfigured({ nodeEnv, surveyTokenSecret }) {
  if (nodeEnv !== 'production') return;
  if (!surveyTokenSecret) {
    throw new Error('SURVEY_TOKEN_SECRET deve ser configurado explicitamente em produção.');
  }
}

const rawEnvSchema = z.object({
  NODE_ENV: stringWithDefault('development'),
  PORT: integerWithDefault('PORT', 4000, { min: 1, max: 65535 }),
  DATABASE_URL: requiredString('DATABASE_URL'),
  DATABASE_CONNECTION_LIMIT: integerWithDefault('DATABASE_CONNECTION_LIMIT', 0, { min: 0 }),
  RESOURCE_LIST_CACHE_TTL_MS: integerWithDefault('RESOURCE_LIST_CACHE_TTL_MS', 60000, { min: 0 }),
  DASHBOARD_CACHE_TTL_MS: integerWithDefault('DASHBOARD_CACHE_TTL_MS', 60000, { min: 0 }),
  ASSETS_DIR: stringWithDefault(path.resolve(process.cwd(), 'assets')),
  REPORTS_DIR: stringWithDefault(''),
  UPLOAD_DIR: stringWithDefault(''),
  // Raiz dos arquivos do módulo Comercial: fotos de escopo e documentos
  // emitidos. Vazio mantém o caminho que as fotos já usam (`<REPORTS_DIR>/Comercial`),
  // para que apontar a variável não seja obrigatório e nada gravado se perca.
  COMERCIAL_DIR: stringWithDefault(''),
  APP_URL: stringWithDefault(''),
  ALLOWED_ORIGIN: stringWithDefault(''),
  TRUST_PROXY: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_HOST: stringWithDefault(''),
  SMTP_PORT: integerWithDefault('SMTP_PORT', 587, { min: 1, max: 65535 }),
  SMTP_SECURE: booleanWithDefault('SMTP_SECURE', false),
  SMTP_USER: stringWithDefault(''),
  SMTP_PASS: stringWithDefault(''),
  SMTP_FROM: stringWithDefault(''),
  SMTP_TEST_DEST: stringWithDefault(''),
  SEND_CLIENT_EMAILS: booleanWithDefault('SEND_CLIENT_EMAILS', true),
  PRIVACY_NOTIFICATION_EMAIL: stringWithDefault(''),
  LGPD_NOTIFICATION_EMAIL: stringWithDefault(''),
  ZAPSIGN_API_TOKEN: stringWithDefault(''),
  ZAPSIGN_REFRESH_TOKEN: stringWithDefault(''),
  APSIGN_REFRESH_TOKEN: stringWithDefault(''),
  ZAPSIGN_USERNAME: stringWithDefault(''),
  ZAPSIGN_LOGIN: stringWithDefault(''),
  ZAPSIGN_EMAIL: stringWithDefault(''),
  ZAPSIGN_PASSWORD: stringWithDefault(''),
  ZAPSIGN_SENHA: stringWithDefault(''),
  ZAPSIGN_ORGANIZATION_ID: stringWithDefault(''),
  ZAPSIGN_ORG_ID: stringWithDefault(''),
  SURVEY_TOKEN_SECRET: stringWithDefault(''),
  SURVEY_TOKEN_SECRET_PREVIOUS: stringWithDefault(''),
  SIGNATURE_TOKEN_SECRET: stringWithDefault(''),
  SIGNATURE_TOKEN_SECRET_PREVIOUS: stringWithDefault(''),
  DATA_RETENTION_JOB_ENABLED: booleanWithDefault('DATA_RETENTION_JOB_ENABLED', false),
  ZAPSIGN_API_BASE_URL: stringWithDefault('https://api.zapsign.com.br/api/v1'),
  LIBREOFFICE_BINARY: stringWithDefault('soffice'),
  DOCX_TO_PDF_TIMEOUT_MS: integerWithDefault('DOCX_TO_PDF_TIMEOUT_MS', 60000, { min: 1 }),
  PRISMA_SLOW_QUERY_MS: integerWithDefault('PRISMA_SLOW_QUERY_MS', 0, { min: 0 }),
  SLOW_OPERATION_LOG_MS: integerWithDefault('SLOW_OPERATION_LOG_MS', 0, { min: 0 }),
  OPERATIONS_BACKUP_STATUS_FILE: stringWithDefault(''),
  OPERATIONS_RESTORE_STATUS_FILE: stringWithDefault(''),
  OPERATIONS_REQUIRE_BACKUP_STATUS: booleanWithDefault('OPERATIONS_REQUIRE_BACKUP_STATUS', false),
  OPERATIONS_REQUIRE_RESTORE_STATUS: booleanWithDefault('OPERATIONS_REQUIRE_RESTORE_STATUS', false),
  OPERATIONS_BACKUP_MAX_AGE_HOURS: integerWithDefault('OPERATIONS_BACKUP_MAX_AGE_HOURS', 26, { min: 1 }),
  OPERATIONS_RESTORE_MAX_AGE_DAYS: integerWithDefault('OPERATIONS_RESTORE_MAX_AGE_DAYS', 30, { min: 1 }),
  OPERATIONS_ALERT_JOB_ENABLED: booleanWithDefault('OPERATIONS_ALERT_JOB_ENABLED', false),
  OPERATIONS_ALERT_INTERVAL_MS: integerWithDefault('OPERATIONS_ALERT_INTERVAL_MS', 60 * 60 * 1000, { min: 60_000 }),
  OPERATIONS_ALERT_WEBHOOK_URL: stringWithDefault(''),
  ERROR_TRACKING_WEBHOOK_URL: stringWithDefault(''),
  ERROR_TRACKING_PROVIDER: stringWithDefault('webhook'),
  COMMERCIAL_IMPORT_TOKEN: stringWithDefault(''),
  OMIE_APP_KEY: stringWithDefault(''),
  OMIE_APP_SECRET: stringWithDefault(''),
  OMIE_SYNC_ENABLED: booleanWithDefault('OMIE_SYNC_ENABLED', false),
  OMIE_SYNC_INTERVAL_MINUTES: integerWithDefault('OMIE_SYNC_INTERVAL_MINUTES', 360, { min: 1 }),
  OMIE_SYNC_SINCE_DAYS: integerWithDefault('OMIE_SYNC_SINCE_DAYS', 7, { min: 1 }),

  /**
   * Envio da proposta ao CRM Nectar.
   *
   * **`off` é o padrão, e a razão é o fornecedor: o Nectar não tem sandbox.**
   * A API publica uma URL só, de produção — não existe homologação para onde
   * apontar. Então qualquer ambiente mal configurado que "tentasse por padrão"
   * criaria card de verdade no CRM da empresa.
   *
   *   off   não tenta, e a finalização diz que o envio está desligado
   *   fake  responde como se tivesse dado certo, sem tocar na rede (dev e testes)
   *   real  usa o token
   */
  NECTAR_MODE: z.enum(['off', 'fake', 'real']).default('off'),
  NECTAR_API_TOKEN: stringWithDefault(''),
  /**
   * Lista branca de funis, separada por vírgula.
   *
   * Sem sandbox, é a contenção que não depende do fornecedor: o ambiente de
   * teste aponta para um funil de testes, e um erro de código não alcança o
   * funil onde o comercial trabalha. Vazia recusa tudo — não é "libera geral".
   */
  NECTAR_PIPELINE_IDS: stringWithDefault(''),
  /**
   * Usuário do Nectar que fica como **responsável** das oportunidades criadas.
   *
   * Obrigatório em `real`: sem ele o Nectar recusa com 409 "Nenhum responsável
   * foi selecionado". A referência trazia o id fixo no código; aqui é
   * configuração, porque o dono muda com o tempo e número mágico no código não
   * se descobre sem ler o código.
   */
  NECTAR_RESPONSAVEL_ID: stringWithDefault(''),

  /**
   * Gravação dos documentos no SharePoint, via Microsoft Graph.
   *
   * Mesmos três modos do Nectar, e `off` também é o padrão: o destino é a
   * biblioteca real da empresa, e não existe cópia de teste dela.
   */
  SHAREPOINT_MODE: z.enum(['off', 'fake', 'real']).default('off'),
  MICROSOFT_TENANT_ID: stringWithDefault(''),
  MICROSOFT_CLIENT_ID: stringWithDefault(''),
  MICROSOFT_CLIENT_SECRET: stringWithDefault(''),
  /**
   * Destino, em três formas — basta uma, e a ordem é de menor privilégio para
   * maior. Com `Sites.Selected` use o DRIVE_ID: ela concede acesso a sites
   * escolhidos um a um e restringe DESCOBERTA, então procurar o site pelo
   * endereço pode voltar 403 mesmo com o site liberado.
   */
  SHAREPOINT_DRIVE_ID: stringWithDefault(''),
  SHAREPOINT_SITE_ID: stringWithDefault(''),
  SHAREPOINT_HOSTNAME: stringWithDefault(''),
  SHAREPOINT_SITE_PATH: stringWithDefault(''),
  /**
   * Tudo é criado DENTRO desta pasta — é a contenção que não depende da
   * Microsoft. Apontar o ambiente de teste para outra mantém o erro de código
   * longe da pasta onde o comercial trabalha.
   */
  SHAREPOINT_BASE_FOLDER: stringWithDefault('02 - Comercial/Projetos em cotação'),

  /**
   * Cálculo automático da distância sede → obra (Google Maps).
   *
   * `off` por padrão, como os outros: o campo continua digitado até alguém
   * ligar. `fake` devolve resposta fixa, sem rede.
   */
  GOOGLE_MAPS_MODE: z.enum(['off', 'fake', 'real']).default('off'),
  GOOGLE_MAPS_API_KEY: stringWithDefault(''),
  /**
   * Teto diário de consultas.
   *
   * A franquia do Google é de 10.000/mês por SKU e **não avisa** ao ser
   * consumida — um defeito em laço passa dela e só aparece na fatura. O teto
   * transforma isso num campo que volta a ser digitado.
   */
  GOOGLE_MAPS_MAX_DIA: integerWithDefault('GOOGLE_MAPS_MAX_DIA', 200, { min: 1 }),
  /**
   * Teto diário das SUGESTÕES de endereço, contado à parte.
   *
   * Um cálculo de distância é um clique; uma sugestão é uma tecla digitada.
   * Somados no mesmo teto, o autocompletar comeria em três endereços a franquia
   * que a distância usa o dia inteiro. 300/dia cabe nos 10.000/mês do SKU.
   */
  GOOGLE_MAPS_MAX_DIA_SUGESTOES: integerWithDefault('GOOGLE_MAPS_MAX_DIA_SUGESTOES', 300, { min: 1 })
  // A origem das rotas — o endereço da sede — NÃO mora aqui. É dado de negócio,
  // editável por gestor na tela de configuração do módulo, e vive no banco
  // (`comercial.ComercialSettings`). Foi `COMERCIAL_SEDE_ENDERECO` até 12/08.
}).passthrough().superRefine((value, ctx) => {
  const trustProxyConfigured = value.TRUST_PROXY !== undefined && String(value.TRUST_PROXY).trim() !== '';
  const trustProxy = parseTrustProxy(value.TRUST_PROXY);

  for (const check of [
    () => assertProductionTrustProxyConfigured({ nodeEnv: value.NODE_ENV, trustProxyConfigured, trustProxy }),
    () => assertProductionSignatureTokenSecretConfigured({
      nodeEnv: value.NODE_ENV,
      signatureTokenSecret: value.SIGNATURE_TOKEN_SECRET
    }),
    () => assertProductionSurveyTokenSecretConfigured({
      nodeEnv: value.NODE_ENV,
      surveyTokenSecret: value.SURVEY_TOKEN_SECRET
    })
  ]) {
    try {
      check();
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

function formatEnvIssues(error) {
  return error.issues
    .map(issue => {
      const pathName = issue.path.length ? issue.path.join('.') : 'ambiente';
      return `- ${pathName}: ${issue.message}`;
    })
    .join('\n');
}

export function loadEnv(source = process.env) {
  const result = rawEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuração de ambiente inválida:\n${formatEnvIssues(result.error)}`);
  }

  const raw = result.data;
  const reportsDir = raw.REPORTS_DIR || raw.UPLOAD_DIR || path.resolve(process.cwd(), 'Relatórios');
  const trustProxyConfigured = raw.TRUST_PROXY !== undefined && String(raw.TRUST_PROXY).trim() !== '';
  const trustProxy = parseTrustProxy(raw.TRUST_PROXY);

  return {
    port: raw.PORT,
    databaseUrl: raw.DATABASE_URL,
    databaseConnectionLimit: raw.DATABASE_CONNECTION_LIMIT,
    resourceListCacheTtlMs: raw.RESOURCE_LIST_CACHE_TTL_MS,
    dashboardCacheTtlMs: raw.DASHBOARD_CACHE_TTL_MS,
    assetsDir: raw.ASSETS_DIR,
    reportsDir,
    uploadDir: reportsDir,
    comercialDir: raw.COMERCIAL_DIR || path.join(reportsDir, 'Comercial'),
    nectarMode: raw.NECTAR_MODE,
    nectarApiToken: raw.NECTAR_API_TOKEN,
    nectarResponsavelId: raw.NECTAR_RESPONSAVEL_ID,
    nectarPipelineIds: raw.NECTAR_PIPELINE_IDS.split(',')
      .map(item => item.trim())
      .filter(Boolean),
    sharepointMode: raw.SHAREPOINT_MODE,
    microsoftTenantId: raw.MICROSOFT_TENANT_ID,
    microsoftClientId: raw.MICROSOFT_CLIENT_ID,
    microsoftClientSecret: raw.MICROSOFT_CLIENT_SECRET,
    sharepointDriveId: raw.SHAREPOINT_DRIVE_ID,
    sharepointSiteId: raw.SHAREPOINT_SITE_ID,
    sharepointHostname: raw.SHAREPOINT_HOSTNAME,
    sharepointSitePath: raw.SHAREPOINT_SITE_PATH,
    sharepointBaseFolder: raw.SHAREPOINT_BASE_FOLDER,
    mapsMode: raw.GOOGLE_MAPS_MODE,
    mapsApiKey: raw.GOOGLE_MAPS_API_KEY,
    mapsMaxDia: raw.GOOGLE_MAPS_MAX_DIA,
    mapsMaxDiaSugestoes: raw.GOOGLE_MAPS_MAX_DIA_SUGESTOES,
    appUrl: raw.APP_URL,
    allowedOrigin: raw.ALLOWED_ORIGIN,
    allowedOrigins: parseOrigins(raw.ALLOWED_ORIGIN),
    trustProxy,
    trustProxyConfigured,
    smtpHost: raw.SMTP_HOST,
    smtpPort: raw.SMTP_PORT,
    smtpSecure: raw.SMTP_SECURE,
    smtpUser: raw.SMTP_USER,
    smtpPass: raw.SMTP_PASS,
    smtpFrom: raw.SMTP_FROM,
    smtpTestDest: raw.SMTP_TEST_DEST,
    sendClientEmails: raw.SEND_CLIENT_EMAILS,
    privacyNotificationEmail: raw.PRIVACY_NOTIFICATION_EMAIL || raw.LGPD_NOTIFICATION_EMAIL,
    zapsignApiToken: raw.ZAPSIGN_API_TOKEN,
    zapsignRefreshToken: raw.ZAPSIGN_REFRESH_TOKEN || raw.APSIGN_REFRESH_TOKEN,
    zapsignUsername: raw.ZAPSIGN_USERNAME || raw.ZAPSIGN_LOGIN || raw.ZAPSIGN_EMAIL,
    zapsignPassword: raw.ZAPSIGN_PASSWORD || raw.ZAPSIGN_SENHA,
    zapsignOrganizationId: raw.ZAPSIGN_ORGANIZATION_ID || raw.ZAPSIGN_ORG_ID,
    surveyTokenSecret: raw.SURVEY_TOKEN_SECRET,
    previousSurveyTokenSecrets: parseList(raw.SURVEY_TOKEN_SECRET_PREVIOUS),
    signatureTokenSecret: raw.SIGNATURE_TOKEN_SECRET,
    previousSignatureTokenSecrets: parseList(raw.SIGNATURE_TOKEN_SECRET_PREVIOUS),
    dataRetentionJobEnabled: raw.DATA_RETENTION_JOB_ENABLED,
    zapsignApiBaseUrl: raw.ZAPSIGN_API_BASE_URL,
    libreOfficeBinary: raw.LIBREOFFICE_BINARY,
    docxToPdfTimeoutMs: raw.DOCX_TO_PDF_TIMEOUT_MS,
    prismaSlowQueryMs: raw.PRISMA_SLOW_QUERY_MS,
    slowOperationLogMs: raw.SLOW_OPERATION_LOG_MS,
    operationsBackupStatusFile: raw.OPERATIONS_BACKUP_STATUS_FILE,
    operationsRestoreStatusFile: raw.OPERATIONS_RESTORE_STATUS_FILE,
    operationsRequireBackupStatus: raw.OPERATIONS_REQUIRE_BACKUP_STATUS,
    operationsRequireRestoreStatus: raw.OPERATIONS_REQUIRE_RESTORE_STATUS,
    operationsBackupMaxAgeHours: raw.OPERATIONS_BACKUP_MAX_AGE_HOURS,
    operationsRestoreMaxAgeDays: raw.OPERATIONS_RESTORE_MAX_AGE_DAYS,
    operationsAlertJobEnabled: raw.OPERATIONS_ALERT_JOB_ENABLED,
    operationsAlertIntervalMs: raw.OPERATIONS_ALERT_INTERVAL_MS,
    operationsAlertWebhookUrl: raw.OPERATIONS_ALERT_WEBHOOK_URL,
    errorTrackingWebhookUrl: raw.ERROR_TRACKING_WEBHOOK_URL,
    errorTrackingProvider: raw.ERROR_TRACKING_PROVIDER,
    commercialImportToken: raw.COMMERCIAL_IMPORT_TOKEN,
    omieAppKey: raw.OMIE_APP_KEY,
    omieAppSecret: raw.OMIE_APP_SECRET,
    omieSyncEnabled: raw.OMIE_SYNC_ENABLED,
    omieSyncIntervalMinutes: raw.OMIE_SYNC_INTERVAL_MINUTES,
    omieSyncSinceDays: raw.OMIE_SYNC_SINCE_DAYS,
    nodeEnv: raw.NODE_ENV
  };
}

const env = loadEnv();

export default env;
