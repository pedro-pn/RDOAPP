import { apiClient } from './client';

export type CostParams = Record<string, number | Record<string, number>>;

export interface CostProfile {
  id: string;
  key: string;
  label: string;
  version: number | null;
  params: CostParams | null;
  updatedAt?: string;
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

export async function saveCostParams(key: string, params: CostParams, note?: string) {
  const { data } = await apiClient.put(`/acompanhamento/custo/perfis/${key}/parametros`, { params, note });
  return data;
}

export async function simulateCost(payload: { profileKey?: string; params?: CostParams; inputs: Record<string, number> }): Promise<CostResult> {
  const { data } = await apiClient.post<CostResult>('/acompanhamento/custo/simular', payload);
  return data;
}

// --- Perfil de custo por cargo (base viva: herda do modelo, sobrescreve salário/insalubridade) ---

export interface CargoCostOverride {
  baseModel?: string; // 'operador' | 'auxiliar' (Modelo 1 / Modelo 2)
  salarioBase?: number;
  insalubridade?: number;
}

export interface CargoCostProfile {
  jobRoleId: string;
  name: string;
  profileId: string | null;
  version: number | null;
  params: CargoCostOverride | null;
  updatedAt: string | null;
}

export async function getCargoCostProfiles(): Promise<CargoCostProfile[]> {
  const { data } = await apiClient.get<CargoCostProfile[]>('/acompanhamento/custo/cargos');
  return data;
}

export async function saveCargoCostParams(jobRoleId: string, params: CargoCostOverride, note?: string) {
  const { data } = await apiClient.put(`/acompanhamento/custo/cargos/${jobRoleId}/parametros`, { params, note });
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
