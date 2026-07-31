import { apiClient } from './client';

export interface ComercialStatus {
  module: string;
  status: string;
}

export async function getComercialStatus() {
  const { data } = await apiClient.get<ComercialStatus>('/comercial/status');
  return data;
}
