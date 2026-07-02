// Code generated from spec/values.yaml - DO NOT EDIT. Run `pnpm gen:values`.
package values

// client_cache
const (
	ClientCacheDefaultStaleMs       = 30000
	ClientCacheDefaultGcMs          = 300000
	ClientCacheDefaultRetryCount    = 1
	ClientCacheOptimisticRollbackMs = 10000
)

// auth_session
const (
	AuthSessionAccessTokenRefreshSkewMs = 60000
)

// supabase_auth
const (
	SupabaseAuthJwksCacheTtlMs            = 600000
	SupabaseAuthJwksMissRefreshIntervalMs = 60000
)

// rendering
const (
	RenderingActiveSkin         = "aurora"
	RenderingMaxPixelRatio      = 2
	RenderingInstanceBucketSize = 4096
)

// ai
const (
	AiEmbeddingDim = 1024
)

// emotion
const (
	EmotionArousalStrengthMin = 0.35
	EmotionArousalStrengthMax = 0.75
	EmotionDefaultIntensity   = 0.7
)

var (
	EmotionMoodValence = map[string]float64{
		"joy":        0.82,
		"calm":       0.62,
		"sad":        -0.78,
		"anger":      -0.76,
		"fear":       -0.82,
		"love":       0.9,
		"neutral":    0,
		"excitement": 0.78,
		"gratitude":  0.76,
		"relief":     0.68,
		"stress":     -0.7,
		"tired":      -0.55,
		"emptiness":  -0.68,
	}
	EmotionMoodArousal = map[string]float64{
		"joy":        0.72,
		"calm":       0.22,
		"sad":        0.28,
		"anger":      0.86,
		"fear":       0.88,
		"love":       0.66,
		"neutral":    0.5,
		"excitement": 0.9,
		"gratitude":  0.38,
		"relief":     0.3,
		"stress":     0.78,
		"tired":      0.18,
		"emptiness":  0.16,
	}
)
