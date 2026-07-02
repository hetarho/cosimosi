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
  emotion: {
    moodValence: {"joy":0.82,"calm":0.62,"sad":-0.78,"anger":-0.76,"fear":-0.82,"love":0.9,"neutral":0,"excitement":0.78,"gratitude":0.76,"relief":0.68,"stress":-0.7,"tired":-0.55,"emptiness":-0.68},
    moodArousal: {"joy":0.72,"calm":0.22,"sad":0.28,"anger":0.86,"fear":0.88,"love":0.66,"neutral":0.5,"excitement":0.9,"gratitude":0.38,"relief":0.3,"stress":0.78,"tired":0.18,"emptiness":0.16},
    arousalStrengthMin: 0.35,
    arousalStrengthMax: 0.75,
    defaultIntensity: 0.7,
  },
} as const
