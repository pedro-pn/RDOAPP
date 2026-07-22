import { apiClient, qualidadeApiPath } from './client';

export type QualityRecordType = 'DESVIO' | 'LICAO_APRENDIDA' | 'INCIDENTE' | 'RECLAMACAO_CLIENTE' | 'MELHORIA';
export type QualityImpact = 'ALTO' | 'MEDIO' | 'BAIXO';
export type QualityDisposition = 'TRATAR' | 'MONITORAR' | 'ARQUIVAR_DIVULGAR';
export type QualityStatus = 'ABERTO' | 'EM_TRIAGEM' | 'EM_OBSERVACAO' | 'EM_ACAO' | 'FECHADO' | 'DIVULGADO';

export interface QualityNature {
  id: string;
  name: string;
  isActive: boolean;
  inUse: boolean;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QualityRecord {
  id: string;
  number: string;
  type: QualityRecordType;
  seq: number;
  year: number;
  registeredAt: string;
  origin: string;
  projectId: string | null;
  project: { id: string; code: string; name: string; isActive?: boolean } | null;
  eventDate: string;
  natureId: string;
  nature: { id: string; name: string; isActive?: boolean } | null;
  description: string;
  impact: QualityImpact;
  occurrences12m: number;
  recurrent: boolean;
  linkedRnc: string | null;
  disposition: QualityDisposition;
  definedAction: string | null;
  actionOwner: string | null;
  actionDeadline: string | null;
  evidence: string | null;
  resultVerification: string | null;
  status: QualityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QualityRecordPayload {
  type: QualityRecordType;
  registeredAt: string;
  origin: string;
  projectId?: string | null;
  eventDate: string;
  natureId: string;
  description: string;
  impact: QualityImpact;
  linkedRnc?: string | null;
  disposition: QualityDisposition;
  definedAction?: string | null;
  actionOwner?: string | null;
  actionDeadline?: string | null;
  evidence?: string | null;
  resultVerification?: string | null;
  status: QualityStatus;
}

export type QualityRecordUpdatePayload = Omit<QualityRecordPayload, 'type'>;

export interface QualityRecordListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: QualityRecordType | '';
  status?: QualityStatus | '';
  impact?: QualityImpact | '';
  projectId?: string | '';
  natureId?: string | '';
}

export interface QualityRecordListResponse {
  items: QualityRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectDeviation {
  id: string;
  number: string;
  registeredAt: string;
  eventDate: string;
  origin: string;
  nature: { id?: string; name: string; isActive?: boolean } | null;
  description: string;
  impact: QualityImpact;
  occurrences12m: number;
  recurrent: boolean;
  linkedRnc: string | null;
  disposition: QualityDisposition;
  definedAction: string | null;
  actionOwner: string | null;
  actionDeadline: string | null;
  status: QualityStatus;
}

export interface QualityNaturePayload {
  name: string;
}

export interface QualityProjectOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

function cleanParams(params?: QualityRecordListParams) {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));
}

export async function listQualityRecords(params?: QualityRecordListParams) {
  const response = await apiClient.get<QualityRecordListResponse>(qualidadeApiPath('/registros'), { params: cleanParams(params) });
  return response.data;
}

export async function getQualityRecord(id: string) {
  const response = await apiClient.get<QualityRecord>(qualidadeApiPath(`/registros/${id}`));
  return response.data;
}

export async function createQualityRecord(payload: QualityRecordPayload) {
  const response = await apiClient.post<QualityRecord>(qualidadeApiPath('/registros'), payload);
  return response.data;
}

export async function updateQualityRecord(id: string, payload: QualityRecordUpdatePayload) {
  const response = await apiClient.put<QualityRecord>(qualidadeApiPath(`/registros/${id}`), payload);
  return response.data;
}

export async function removeQualityRecord(id: string) {
  await apiClient.delete(qualidadeApiPath(`/registros/${id}`));
}

export async function exportQualityRecords(params?: QualityRecordListParams) {
  const response = await apiClient.get<Blob>(qualidadeApiPath('/registros/export'), {
    params: cleanParams(params),
    responseType: 'blob'
  });
  return response.data;
}

export async function listProjectQualityDeviations(projectId: string) {
  const response = await apiClient.get<ProjectDeviation[]>(qualidadeApiPath(`/registros/projeto/${projectId}/desvios`));
  return response.data;
}

export async function listQualityProjects() {
  const response = await apiClient.get<QualityProjectOption[]>(qualidadeApiPath('/projetos'));
  return response.data;
}

export async function listQualityNatures(params?: { includeInactive?: boolean }) {
  const response = await apiClient.get<QualityNature[]>(qualidadeApiPath('/naturezas'), { params });
  return response.data;
}

export async function createQualityNature(payload: QualityNaturePayload) {
  const response = await apiClient.post<QualityNature>(qualidadeApiPath('/naturezas'), payload);
  return response.data;
}

export async function updateQualityNature(id: string, payload: QualityNaturePayload) {
  const response = await apiClient.put<QualityNature>(qualidadeApiPath(`/naturezas/${id}`), payload);
  return response.data;
}

export async function setQualityNatureActive(id: string, isActive: boolean) {
  const response = await apiClient.patch<QualityNature>(qualidadeApiPath(`/naturezas/${id}/ativo`), { isActive });
  return response.data;
}

export async function removeQualityNature(id: string) {
  await apiClient.delete(qualidadeApiPath(`/naturezas/${id}`));
}
