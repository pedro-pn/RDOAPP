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
