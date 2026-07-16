import { apiClient } from './client';

export type CostParams = Record<string, number | Record<string, number>>;

export interface CostParameterHistoryEntry {
  effectiveDate: string;
  params: CostParams | null;
  note?: string | null;
  updatedAt: string | null;
}

export interface CostProfile {
  id: string;
  key: string;
  label: string;
  effectiveDate?: string | null;
  params: CostParams | null;
  updatedAt?: string;
  history: CostParameterHistoryEntry[];
}

export interface CostResult {
  remuneracaoBruta: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  passivoRescisorio: number;
  totalMensal: number;
  custoHora220: number;
  custoHora176: number;
  custoDiaUtil: number;
  periculosidade: number;
  produtividade: number;
  transferencia: number;
  valorHora: number;
  he70: number;
  he100: number;
  dsr: number;
}

export async function getCostProfiles(): Promise<CostProfile[]> {
  const { data } = await apiClient.get<CostProfile[]>('/acompanhamento/custo/perfis');
  return data;
}

export async function saveCostParams(key: string, params: CostParams, effectiveDate: string, note?: string) {
  const { data } = await apiClient.put(`/acompanhamento/custo/perfis/${key}/parametros`, { params, effectiveDate, note });
  return data;
}

export async function simulateCost(payload: { profileKey?: string; params?: CostParams; inputs: Record<string, number> }): Promise<CostResult> {
  const { data } = await apiClient.post<CostResult>('/acompanhamento/custo/simular', payload);
  return data;
}

// --- Perfil de custo por cargo (herda do modelo por vigência, sobrescreve salário/insalubridade) ---

export interface CargoCostOverride {
  baseModel?: string; // 'operador' | 'auxiliar' (Modelo 1 / Modelo 2)
  salarioBase?: number;
  insalubridade?: number;
}

export interface CargoCostHistoryEntry {
  effectiveDate: string;
  params: CargoCostOverride | null;
  note?: string | null;
  updatedAt: string | null;
}

export interface CargoCostProfile {
  jobRoleId: string;
  name: string;
  profileId: string | null;
  effectiveDate: string | null;
  params: CargoCostOverride | null;
  updatedAt: string | null;
  history: CargoCostHistoryEntry[];
}

export async function getCargoCostProfiles(): Promise<CargoCostProfile[]> {
  const { data } = await apiClient.get<CargoCostProfile[]>('/acompanhamento/custo/cargos');
  return data;
}

export async function saveCargoCostParams(jobRoleId: string, params: CargoCostOverride, effectiveDate: string, note?: string) {
  const { data } = await apiClient.put(`/acompanhamento/custo/cargos/${jobRoleId}/parametros`, { params, effectiveDate, note });
  return data;
}

// --- Configuração global de custo (EPI por colaborador) ---

export interface CostConfig {
  epiAnnualCost: number;
}

export async function getCostConfig(): Promise<CostConfig> {
  const { data } = await apiClient.get<CostConfig>('/acompanhamento/custo/config');
  return data;
}

export async function saveCostConfig(epiAnnualCost: number): Promise<CostConfig> {
  const { data } = await apiClient.put<CostConfig>('/acompanhamento/custo/config', { epiAnnualCost });
  return data;
}

// --- Categorias Omie incluídas nos cálculos do acompanhamento ---

export interface OmieCostCategory {
  id: string;
  codigo: string;
  descricao: string | null;
  includeInAcompanhamentoCosts: boolean;
  syncedAt?: string;
  purchasesCount: number;
  purchasesTotal: string | number | null;
}

export async function getOmieCostCategories(): Promise<OmieCostCategory[]> {
  const { data } = await apiClient.get<OmieCostCategory[]>('/acompanhamento/custo/categorias-omie');
  return data;
}

export async function setOmieCostCategoryIncluded(codigo: string, includeInAcompanhamentoCosts: boolean): Promise<OmieCostCategory> {
  const { data } = await apiClient.put<OmieCostCategory>(
    `/acompanhamento/custo/categorias-omie/${encodeURIComponent(codigo)}`,
    { includeInAcompanhamentoCosts }
  );
  return data;
}
