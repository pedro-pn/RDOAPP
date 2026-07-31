import { useQuery } from '@tanstack/react-query';

import { getComercialStatus } from '../api/comercial';

export function useComercialStatus() {
  return useQuery({
    queryKey: ['comercial', 'status'],
    queryFn: getComercialStatus
  });
}
