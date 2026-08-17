import { apiClient } from './client';

export interface PontoImportRow {
  id: string;
  fileName: string;
  periodStart: string;
  periodEnd: string;
  rowsRead: number;
  collaboratorsTotal: number;
  collaboratorsMatched: number;
  status: string;
  source?: 'XLSX' | 'PONTOMAIS_API' | string;
  createdAt: string;
}

export interface PontoMaisRunSummary {
  id: string;
  trigger: 'MANUAL' | 'AUTOMATIC_BOOTSTRAP' | 'AUTOMATIC_DAILY' | string;
  periodStart: string;
  periodEnd: string;
  completedAt: string | null;
  pendingCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface PontoMaisIntegrationStatus {
  configured: boolean;
  running: boolean;
  automation: {
    bootstrapStatus: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | string;
    historyStart: string | null;
    historyThrough: string | null;
    nextPeriodStart: string | null;
    lastDailySyncDate: string | null;
    lastAttemptAt: string | null;
    lastSuccessfulAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    scheduledTime: string;
    timeZone: string;
  };
  lastSuccessfulRun: PontoMaisRunSummary | null;
  lastFailure: PontoMaisRunSummary | null;
}

export interface PontoMaisSyncResult {
  runId: string;
  status: 'SUCCEEDED';
  trigger: 'MANUAL' | 'AUTOMATIC_BOOTSTRAP' | 'AUTOMATIC_DAILY' | string;
  skippedDuplicate: boolean;
  importId: string;
  periodStart: string;
  periodEnd: string;
  employeesRead: number;
  workDaysRead: number;
  timeCardsRead: number;
  collaboratorsTotal: number;
  collaboratorsMatched: number;
  pendingCount: number;
}

export interface PontoMaisSyncRun extends PontoMaisRunSummary {
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | string;
  employeesRead: number;
  workDaysRead: number;
  timeCardsRead: number;
  collaboratorsMatched: number;
  startedAt: string;
}

export interface PontoMaisPendingEmployee {
  externalEmployeeId: string;
  registrationNumber: string | null;
  externalName: string;
  reason: string;
}

export interface PontoMaisPendingProjectTag {
  rawTag: string;
  normalizedTag: string;
  reason: string;
}

export interface PontoMaisPendingAmbiguousDay {
  externalEmployeeId: string;
  externalName: string;
  date: string;
  projectCodes: string[];
  tagProjectCodes: string[];
  rdoProjectCodes: string[];
  reason: string;
}

export interface PontoMaisPending {
  employees: PontoMaisPendingEmployee[];
  ambiguousDays: PontoMaisPendingAmbiguousDay[];
  missingProjects: {
    projectTags: PontoMaisPendingProjectTag[];
    ambiguousDays: PontoMaisPendingAmbiguousDay[];
  };
}

export interface PontoMaisReconciliationProject {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  historical: boolean;
}

export interface PontoMaisExternalEmployee {
  externalEmployeeId: string;
  registrationNumber: string | null;
  externalName: string;
  isActive: boolean | null;
  ignored: boolean;
}

export function pontoMaisSyncTriggerLabel(trigger: string): string {
  if (trigger === 'AUTOMATIC_BOOTSTRAP') return 'Carga histórica automática';
  if (trigger === 'AUTOMATIC_DAILY') return 'Atualização diária automática';
  return 'Contingência manual';
}

export function pontoMaisBootstrapStatusLabel(status: string, running = false): string {
  if (running) return 'Sincronização em andamento';
  if (status === 'SUCCEEDED') return 'Carga histórica concluída';
  if (status === 'FAILED') return 'Carga histórica aguardando nova tentativa automática';
  if (status === 'RUNNING') return 'Carga histórica em andamento';
  return 'Carga histórica aguardando início';
}

export interface UnmatchedPontoName {
  rawName: string;
  normalizedName: string;
}

export interface IdleBucket {
  cost: number;
  costBase: number;
  hours: number;
}

export interface CollaboratorMonthRate {
  month: string; // YYYY-MM
  normalHoras: number;
  he70Horas: number;
  he100Horas: number;
  totalMensal: number;
  totalMensalBase: number;
  fixoMensal: number;
  variavelMensal: number;
  custoHora: number;
  custoHoraBase: number;
  idle: { sede: IdleBucket; folga: IdleBucket };
}

export interface CollaboratorRate {
  collaboratorId: string;
  name: string;
  role: string | null;
  hasCostProfile: boolean;
  normalHoras: number;  // horas normais do ponto (somado)
  he70Horas: number;
  he100Horas: number;
  totalHoras: number;   // horas do ponto (normais + HE)
  folgaHours: number;
  totalMensalBase: number | null; // folha sem offshore
  totalMensal: number | null;     // folha (com offshore), somando a divisão mensal
  fixoMensal: number | null;      // base do motor sem dias + EPI (proporcional no mês parcial)
  variavelMensal: number | null;  // folha − fixo
  custoHoraBase: number | null;
  custoHora: number | null;       // HH = folha ÷ (horas do ponto + folga)
  idle: {
    sede: IdleBucket;   // ponto batido, não alocado a nenhuma obra
    folga: IdleBucket;  // dia de semana sem ponto (8,8h)
  };
  months: CollaboratorMonthRate[]; // detalhe por mês (para o filtro)
}

export interface PontoColaboradores {
  importId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fileName: string | null;
  rates: CollaboratorRate[];
  unmatched: UnmatchedPontoName[];
}

export interface PontoImportResult {
  skippedDuplicate: boolean;
  importId: string;
  collaboratorsTotal?: number;
  collaboratorsMatched?: number;
  unmatched?: UnmatchedPontoName[];
  periodStart?: string;
  periodEnd?: string;
}

export async function getPontoImports(): Promise<PontoImportRow[]> {
  const { data } = await apiClient.get<PontoImportRow[]>('/acompanhamento/ponto/imports');
  return data;
}

export async function getPontoMaisIntegrationStatus(): Promise<PontoMaisIntegrationStatus> {
  const { data } = await apiClient.get<PontoMaisIntegrationStatus>('/acompanhamento/ponto/integration-status');
  return data;
}

export async function syncPontoMais(payload: { startDate: string; endDate: string }): Promise<PontoMaisSyncResult> {
  const { data } = await apiClient.post<PontoMaisSyncResult>('/acompanhamento/ponto/sync', payload);
  return data;
}

export async function getPontoMaisSyncRuns(limit = 50): Promise<PontoMaisSyncRun[]> {
  const { data } = await apiClient.get<PontoMaisSyncRun[]>('/acompanhamento/ponto/sync-runs', { params: { limit } });
  return data;
}

export async function getPontoMaisPending(): Promise<PontoMaisPending> {
  const { data } = await apiClient.get<PontoMaisPending>('/acompanhamento/ponto/pending');
  return data;
}

export async function getPontoMaisExternalEmployees(): Promise<PontoMaisExternalEmployee[]> {
  const { data } = await apiClient.get<PontoMaisExternalEmployee[]>('/acompanhamento/ponto/external-employees');
  return data;
}

export async function setPontoMaisExternalEmployeeIgnored(payload: {
  externalEmployeeId: string;
  ignored: boolean;
}): Promise<PontoMaisExternalEmployee> {
  const { data } = await apiClient.post<PontoMaisExternalEmployee>(
    '/acompanhamento/ponto/external-employees/ignore',
    payload
  );
  return data;
}

export async function getPontoMaisReconciliationProjects(): Promise<PontoMaisReconciliationProject[]> {
  const { data } = await apiClient.get<PontoMaisReconciliationProject[]>(
    '/acompanhamento/ponto/reconciliation-projects'
  );
  return data;
}

export async function linkPontoMaisExternalEmployee(payload: { externalEmployeeId: string; collaboratorId: string }) {
  const { data } = await apiClient.post<{ externalEmployeeId: string; collaboratorId: string; relinked: number }>(
    '/acompanhamento/ponto/external-employees/link',
    payload
  );
  return data;
}

export async function linkPontoMaisProjectTag(payload: { rawTag: string; projectId: string }) {
  const { data } = await apiClient.post<{ normalizedTag: string; projectId: string }>(
    '/acompanhamento/ponto/project-tags/link',
    payload
  );
  return data;
}

export async function setPontoMaisDayProjectOverride(payload: {
  externalEmployeeId: string;
  date: string;
  projectIds: string[];
}) {
  const { data } = await apiClient.post<{
    externalEmployeeId: string;
    date: string;
    projectIds: string[];
  }>('/acompanhamento/ponto/day-project-overrides', payload);
  return data;
}

export async function setPontoMaisDayProjectOverridesBatch(payload: {
  items: Array<{ externalEmployeeId: string; date: string; projectIds: string[] }>;
}) {
  const { data } = await apiClient.post<{ updated: number }>(
    '/acompanhamento/ponto/day-project-overrides/batch',
    payload
  );
  return data;
}

export async function deletePontoImport(id: string): Promise<void> {
  await apiClient.delete(`/acompanhamento/ponto/imports/${id}`);
}

export async function getPontoColaboradores(): Promise<PontoColaboradores> {
  const { data } = await apiClient.get<PontoColaboradores>('/acompanhamento/ponto/colaboradores');
  return data;
}

export interface ActiveCollaborator {
  id: string;
  name: string;
  role: string | null;
  isActive: boolean;
}

export async function getActiveCollaborators(): Promise<ActiveCollaborator[]> {
  const { data } = await apiClient.get<ActiveCollaborator[]>('/acompanhamento/ponto/colaboradores-ativos');
  return data;
}

export async function getPontoLinkCollaborators(): Promise<ActiveCollaborator[]> {
  const { data } = await apiClient.get<ActiveCollaborator[]>('/acompanhamento/ponto/colaboradores-ativos', {
    params: { includeInactive: 'true' }
  });
  return data;
}

export async function importPonto(file: File): Promise<PontoImportResult> {
  const { data } = await apiClient.post<PontoImportResult>('/acompanhamento/ponto/import', file, {
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': file.name }
  });
  return data;
}

export async function linkPontoName(payload: { normalizedName?: string; rawName?: string; collaboratorId: string }) {
  const { data } = await apiClient.post('/acompanhamento/ponto/vincular', payload);
  return data as { normalizedName: string; collaboratorId: string; relinked: number };
}
