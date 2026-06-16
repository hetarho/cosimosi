// Code generated from spec/values.yaml — DO NOT EDIT. Run `pnpm gen:values`.
//
// Canonical tuning values ("balance patch"). Edit spec/values.yaml, then run `pnpm gen:values`.
// Consts are untyped so they drop into float32/float64/int contexts exactly like a literal.
package values

// decay
const (
	DecayAMin         = 0.05
	DecayHalfLifeDays = 30
	DecayAlphaConn    = 0.6
	DecayBetaRecent   = 0.5
	DecayGammaEmo     = 0.7
	DecayDeltaVal     = 0.4
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
