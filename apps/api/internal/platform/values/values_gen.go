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
