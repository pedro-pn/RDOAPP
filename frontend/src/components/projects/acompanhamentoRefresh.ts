export const ACOMPANHAMENTO_REFRESH_INTERVAL_MS = 30_000;

export const acompanhamentoRefreshQueryOptions = {
  refetchInterval: ACOMPANHAMENTO_REFRESH_INTERVAL_MS,
  refetchIntervalInBackground: true
} as const;
