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
	RenderingActiveSkin            = "aurora"
	RenderingMaxPixelRatio         = 2
	RenderingInstanceBucketSize    = 4096
	RenderingStarSizeMin           = 0.9
	RenderingStarSizeMax           = 3.2
	RenderingStarBrightnessMin     = 0.15
	RenderingStarBrightnessMax     = 1
	RenderingFilamentWidthMin      = 0.04
	RenderingFilamentWidthMax      = 0.35
	RenderingFilamentBrightnessMin = 0.12
	RenderingFilamentBrightnessMax = 0.85
	RenderingCellStarPointSize     = 0.35
	RenderingLatentStarCount       = 800
	RenderingLatentStarCountMobile = 300
	RenderingLatentFieldRadius     = 34
	RenderingLatentStarSize        = 0.14
	RenderingAwakenCapacity        = 32
	RenderingGistStarSizeMin       = 0.7
	RenderingGistStarSizeMax       = 2.4
	RenderingGistStarDiffuse       = 0.55
	RenderingGistRiseLayerFog      = 0.35
)

// nebula
const (
	NebulaBleedRadiusCoefficient = 12
	NebulaMinBleedRadius         = 3
	NebulaFalloffExponent        = 3.5
	NebulaMaxContributors        = 96
	NebulaFieldResolutionWeb     = 24
	NebulaFieldResolutionMobile  = 10
	NebulaBaseIntensity          = 0.3
)

// ai
const (
	AiEmbeddingDim     = 1024
	AiPerCallTokenCap  = 1200
	AiDailyCallCap     = 200
	AiJobMaxAttempts   = 5
	AiJobBackoffBaseMs = 60000
	AiJobLeaseMs       = 300000
	AiJobMaxClaims     = 20
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

// encode
const (
	EncodeMinMemories              = 2
	EncodeMaxMemories              = 5
	EncodeMinSemanticNeurons       = 1
	EncodeMaxReviseRetries         = 3
	EncodeMaxOutputTokens          = 1000
	EncodeDedupSimilarityThreshold = 0.85
	EncodeDedupTopK                = 8
	EncodeDedupBodyMatchLimit      = 32
	EncodeActivationWeight         = 1
)

// synapse
const (
	SynapsePotentiationRate    = 0.2
	SynapseStrengthCap         = 1
	SynapseInitialSameMemory   = 0.32
	SynapseInitialSharedNeuron = 0.2
	SynapseInitialTemporal     = 0.08
	SynapseStrengthDecayPerDay = 0.015
	SynapseTemporalWindowDays  = 3
	SynapseTemporalBonus       = 0.1
)

// semantic
const (
	SemanticGistUnitsPerStage = 10
)

// reconsolidation
const (
	ReconsolidationRecallStrengthGain     = 0.15
	ReconsolidationNeighborSlowDays       = -2
	ReconsolidationNeighborSpeedDays      = 3
	ReconsolidationNeighborSpeedThreshold = 2
)

// consolidation
const (
	ConsolidationDownscaleFactor    = 0.05
	ConsolidationDownscaleFloor     = 0.05
	ConsolidationDownscaleWeakBias  = 2
	ConsolidationReplayNeighborHops = 1
)

// forgetting
const (
	ForgettingBrightnessDecayPerDay     = 0.02
	ForgettingBrightnessFloor           = 0.15
	ForgettingStageIntervalDays         = 30
	ForgettingArousalSlowCoefficient    = 1
	ForgettingConnectionSlowCoefficient = 1
	ForgettingCostWeightFloor           = 1
	ForgettingCostWeightCap             = 4
	ForgettingCostWeightCurve           = 2
)

var (
	ForgettingStageWordRemovalRatios = []float64{0.2, 0.4, 0.6, 0.85}
)

// twinkle
const (
	TwinkleBasicDailyAmount       = 100
	TwinkleRecallBaseCost         = 5
	TwinkleRecallDepthCoefficient = 10
	TwinkleRecallMaxCost          = 40
	TwinkleGistBaseCost           = 10
	TwinkleGistStageDiscount      = 3
	TwinkleGistMinCost            = 3
)

// force_sim
const (
	ForceSimCharge          = 0.035
	ForceSimLinkDistance    = 12
	ForceSimCenterStrength  = 0.018
	ForceSimRepulsion       = 2.4
	ForceSimTickAlphaDecay  = 0.022
	ForceSimVelocityDamping = 0.62
	ForceSimMinAlpha        = 0.02
	ForceSimHippocampusZMin = 0
	ForceSimHippocampusZMax = 10
	ForceSimNeocortexZMin   = 15
	ForceSimNeocortexZMax   = 25
	ForceSimSeed            = 190019
)
