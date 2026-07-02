/* GENERATED FROM spec/values.yaml - DO NOT EDIT. Run `pnpm gen:values`. */
export const VALUES = {
  clientCache: {
    defaultStaleMs: 30000,
    defaultGcMs: 300000,
    defaultRetryCount: 1,
    optimisticRollbackMs: 10000,
  },
  authSession: {
    accessTokenRefreshSkewMs: 60000,
  },
  supabaseAuth: {
    jwksCacheTtlMs: 600000,
    jwksMissRefreshIntervalMs: 60000,
  },
  rendering: {
    activeSkin: "aurora",
    maxPixelRatio: 2,
    instanceBucketSize: 4096,
  },
  ai: {
    embeddingDim: 1024,
  },
} as const
