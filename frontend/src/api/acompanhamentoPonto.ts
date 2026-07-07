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
  createdAt: string;
}

export interface UnmatchedPontoName {
  rawName: string;
  normalizedName: string;
}

export interface CollaboratorRate {
  collaboratorId: string;
  name: string;
  role: string | null;
  hasCostProfile: boolean;
  totalHoras: number;
  he70Horas: number;
  he100Horas: number;
  diasFora: number;
  offshoreDays: number;
  totalMensalBase: number | null;
  totalMensal: number | null;
  custoHoraBase: number | null;
  custoHora: number | null;
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

export async function getPontoColaboradores(): Promise<PontoColaboradores> {
  const { data } = await apiClient.get<PontoColaboradores>('/acompanhamento/ponto/colaboradores');
  return data;
}

export interface ActiveCollaborator {
  id: string;
  name: string;
  role: string | null;
}

export async function getActiveCollaborators(): Promise<ActiveCollaborator[]> {
  const { data } = await apiClient.get<ActiveCollaborator[]>('/acompanhamento/ponto/colaboradores-ativos');
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
