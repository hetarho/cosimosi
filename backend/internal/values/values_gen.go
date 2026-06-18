// Code generated from spec/values.yaml — DO NOT EDIT. Run `pnpm gen:values`.
//
// Canonical tuning values ("balance patch"). Edit spec/values.yaml, then run `pnpm gen:values`.
// Scalar consts are untyped so they drop into float32/float64/int contexts exactly like a
// literal. Numeric-array vars ([]float64 / [][]float64) carry render-only tuning arrays; some
// are unused on the server (FE-only knobs) — that's fine, this file is the shared source.
package values

// decay
const (
	DecayAMin          = 0.05
	DecayHalfLifeDays  = 30
	DecayDormantFactor = 2
	DecayAlphaConn     = 0.6
	DecayBetaRecent    = 0.5
	DecayGammaEmo      = 0.7
	DecayDeltaVal      = 0.4
)

// consolidation
const (
	ConsolidationRedistributeLerp     = 0.6
	ConsolidationSchemaBonus          = 0.15
	ConsolidationSchemaMinCluster     = 3
	ConsolidationSchemaMinDegree      = 2
	ConsolidationGistAgeDays          = 30
	ConsolidationGistRecallCutoffDays = 14
	ConsolidationGistFormSimplify     = 0.4
	ConsolidationWeakEdgeThreshold    = 0.2
	ConsolidationWeakEdgeIdleDays     = 14
	ConsolidationWeakEdgeFloor        = 0.05
)

// force_sim
const (
	ForceSimTheta           = 0.9
	ForceSimRepulsion       = -30
	ForceSimLinkDistance    = 30
	ForceSimCenterGravity   = 0.01
	ForceSimVelocityDecay   = 0.6
	ForceSimAlphaMin        = 0.001
	ForceSimRadialStrength  = 0.08
	ForceSimLinkStrength    = 1
	ForceSimMaxSpeedFactor  = 2
	ForceSimAlphaDecayTicks = 300
	ForceSimMinDist         = 1
	ForceSimMinDist2        = 1
	ForceSimSeedRadius      = 30
	ForceSimSeedHeatFloor   = 0.1
)

// connection
const (
	ConnectionKnnK               = 8
	ConnectionWeightAlpha        = 1
	ConnectionTemporalBonusMax   = 0.3
	ConnectionTemporalWindowDays = 7
	ConnectionSemanticWeightCap  = 0.79
	ConnectionIntraEntryWeight   = 0.8
)

// excitability
const (
	ExcitabilityTauHours     = 6
	ExcitabilityWExc         = 0.25
	ExcitabilityBiasedK      = 5
	ExcitabilityInhibitDecay = 0.5
)

// reshape
const (
	ReshapePeThreshold         = 0.15
	ReshapeBaseStep            = 0.22
	ReshapeMinBrightStep       = 0.1
	ReshapeMaxBrightStep       = 0.22
	ReshapeBrightnessOffsetMax = 1
	ReshapeNeighborFactor      = 0.4
	ReshapeHueGainDeg          = 60
	ReshapeHueMaxDeg           = 28
	ReshapeFormGain            = 0.5
	ReshapeFormDeltaMax        = 0.6
	ReshapeStrengthRecallGain  = 0.15
	ReshapeAgeGain             = 0.3
	ReshapeAgeRefDays          = 90
)

// ambient
const (
	AmbientTauMoodDays     = 7
	AmbientArousalGain     = 0.3
	AmbientWindowTauFactor = 3
	AmbientLightsK         = 6
	AmbientLightMinShare   = 0.04
	AmbientValenceWarmGain = 0.12
	AmbientValenceSatGain  = 0.25
)

// recall
const (
	RecallCoRecallDelta  = 0.05
	RecallDwellMs        = 2000
	RecallSpacingGain    = 1
	RecallSpacingRefDays = 1
)

// extraction
const (
	ExtractionMaxSegments = 5
)

// invite
const (
	InviteCodeLength         = 8
	InviteValidateDebounceMs = 400
	InviteCharStaggerMs      = 60
	InviteCelebrateMs        = 1200
)
var (
	InviteTimedPresetHours = []float64{24, 168, 720}
)

// customization
const (
	CustomizationStartingStardust = 100
)
var (
	CustomizationPrice = map[string]int{
		"background:lively":      30,
		"background:calm":        30,
		"background:aurora-veil": 45,
		"star:aurora":            30,
		"star:liquid":            35,
		"star:ember":             40,
		"self:core":              30,
		"self:well":              35,
		"synapse:beam":           30,
		"synapse:flow":           35,
		"synapse:particle":       40,
	}
	CustomizationFree = map[string]string{
		"background": "vast",
		"star":       "deepfield",
		"self":       "nebula-heart",
		"synapse":    "filament",
	}
)

// radial_layout
const (
	RadialLayoutRepulsion      = -18
	RadialLayoutLinkDistance   = 14
	RadialLayoutRadialStrength = 0.1
	RadialLayoutRMin           = 6
	RadialLayoutRMax           = 40
	RadialLayoutWActivation    = 0.7
	RadialLayoutWIntensity     = 0.3
	RadialLayoutDriftStepRad   = 0.08
)

// star_render
const (
	StarRenderSizeBase       = 0.6
	StarRenderSizeRange      = 1.4
	StarRenderBirthDurS      = 1.2
	StarRenderBurstDurS      = 1.6
	StarRenderBurstBaseScale = 2.5
	StarRenderBurstGrow      = 16
	StarRenderBurstFadeGain  = 1.2
)

// star_lighting
const (
	StarLightingSelfIntensity          = 0.9
	StarLightingSelfDistance           = 50
	StarLightingSelfDecay              = 0.7
	StarLightingLitAlbedoGain          = 0.4
	StarLightingLitMix                 = 1
	StarLightingAmbientFill            = 0.4
	StarLightingBackdropLightIntensity = 0.7
)
var (
	StarLightingBackdropLightDir = []float64{0.6, 0.7, 0.4}
)

// self_glow
const (
	SelfGlowConnectednessGain = 0.6
	SelfGlowWeightTerm        = 0.5
)

// resonance_ring
const (
	ResonanceRingBaseScale  = 2.6
	ResonanceRingPulseScale = 0.12
	ResonanceRingPulseSpeed = 1.4
	ResonanceRingOpacityMin = 0.22
	ResonanceRingOpacityAmp = 0.42
)

// focus
const (
	FocusDim             = 0.12
	FocusBoost           = 1.3
	FocusSynapseDimStar  = 0.1
	FocusSynapseDimDiary = 0.12
)

// synapse
const (
	SynapseWidthThinPx    = 1
	SynapseWidthThickPx   = 4
	SynapseThickThreshold = 0.5
	SynapseAlphaMin       = 0.15
	SynapseVitalityCap    = 0.12
	SynapseVitalityLogDiv = 4
	SynapsePulseFreq      = 3
	SynapseLineWidthPx    = 2
	SynapseTwistTurns     = 2.5
	SynapseFlowSpeed      = 0.22
)
var (
	SynapseStrandBounds  = []float64{0.35, 0.6, 0.85}
	SynapseStrandCount   = []float64{2, 4, 6, 9}
	SynapseStrandRadius  = []float64{0.01, 0.018, 0.028, 0.04}
	SynapseStrandBright  = []float64{0.2, 0.32, 0.45, 0.6}
	SynapseStrandOpacity = []float64{0.5, 0.62, 0.72, 0.82}
)

// bloom
const (
	BloomStrength  = 0.9
	BloomRadius    = 0.5
	BloomThreshold = 0.1
)

// cosmos
const (
	CosmosSceneDpr           = 1.5
	CosmosFpsCap             = 30
	CosmosFluidOctaves       = 3
	CosmosBackBrightness     = 0.5
	CosmosTwinkleCount       = 90
	CosmosQualityLowMaxCores = 4
)

// ambient_nebula
const (
	AmbientNebulaBaseBright    = 0.06
	AmbientNebulaArousalBright = 0.2
	AmbientNebulaCrossfadeS    = 0.8
	AmbientNebulaDriftSpeed    = 0.05
	AmbientNebulaDriftAmp      = 16
	AmbientNebulaShimmer       = 0.06
)

// self_star
const (
	SelfStarRadius = 5
)

// layout
const (
	LayoutRekickThreshold = 0.5
	LayoutRekickAlpha     = 0.3
)

// star_dust
const (
	StarDustOpacityDimmed = 0.14
	StarDustOpacityNormal = 0.5
)

// overlay
const (
	OverlayTintStrength = 0.16
	OverlaySkyOffset    = 66
)

// resonance_bridge
const (
	ResonanceBridgeFlowSpeed   = 0.16
	ResonanceBridgeBaseGlow    = 0.5
	ResonanceBridgePeakGlow    = 1
	ResonanceBridgeFocusBoost  = 1.7
	ResonanceBridgeLineWidthPx = 3
)

// wayfinding
const (
	WayfindingFrameMargin      = 1.3
	WayfindingFrameMinDistance = 12
)

// wobble
const (
	WobbleAmp = 1
)
var (
	WobbleFreq  = [][]float64{{0.24, 0.2}, {0.2, 0.26}, {0.16, 0.32}}
	WobblePhase = []float64{1.7, 3.1, 5.3}
)

// demo_linking
const (
	DemoLinkingKnnK                  = 5
	DemoLinkingSimTau                = 0.4
	DemoLinkingCoRecallBump          = 0.1
	DemoLinkingCoRecallBase          = 0.5
	DemoLinkingAddSameDayLinks       = 2
	DemoLinkingAddSameMoodLinks      = 1
	DemoLinkingAddTemporalWeight     = 0.55
	DemoLinkingAddSemanticWeight     = 0.6
	DemoLinkingAddExcitabilityWeight = 0.66
)

// demo_consolidation
const (
	DemoConsolidationGistFormSimplify  = 0.18
	DemoConsolidationWeakEdgeThreshold = 0.7
	DemoConsolidationWeakEdgeFloor     = 0.12
)

// demo_overlay
const (
	DemoOverlayMaxBridges = 4
)
