import { apiClient, rdoApiPath } from './client';

export interface DdsTheme {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
}

export async function listDdsThemes(all = false): Promise<DdsTheme[]> {
  const { data } = await apiClient.get<DdsTheme[]>(rdoApiPath(`/dds-themes${all ? '?all=true' : ''}`));
  return data;
}

export async function createDdsTheme(name: string): Promise<DdsTheme> {
  const { data } = await apiClient.post<DdsTheme>(rdoApiPath('/dds-themes'), { name });
  return data;
}

export async function updateDdsTheme(id: string, payload: { name?: string; isActive?: boolean; order?: number }): Promise<DdsTheme> {
  const { data } = await apiClient.patch<DdsTheme>(rdoApiPath(`/dds-themes/${id}`), payload);
  return data;
}

export async function deactivateDdsTheme(id: string): Promise<void> {
  await apiClient.delete(rdoApiPath(`/dds-themes/${id}`));
}
