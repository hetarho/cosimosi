package achievement

import "slices"

// The catalog is CODE, not a table — there is nothing per-user about which achievements exist, so
// an achievements table would only be a second place for these rows to drift from ([A2]). Rows are
// content, not values: only the tier amounts a Reward resolves through live in values.yaml. The
// total is the table's length — derived, never declared.
//
// The slice order IS the server-fixed answer order (axis order, then target ascending within a
// counter), so no client sorts the catalog and no second sort key is kept anywhere ([U9]).
//
// Exactly two rows carry an ornament ([A3] "아주 가끔", [P11] scarcity): the STAR_TOTAL and
// NEURON_SHARING capstones, pairing 1:1 with the store catalog's two achievement-only ornaments —
// asserted at the composition root, the one package that sees both catalogs. Every other reward,
// including the MOOD_VARIETY 13-capstone, is GENERAL Twinkle: a palette is never a reward ([P10]
// as amended).

// Axis is the UI's grouping key — the [A2] axes. No group label crosses the wire; the FE resolves
// copy from the enum.
type Axis string

const (
	AxisFirstExperience    Axis = "FIRST_EXPERIENCE"
	AxisDiaryTotal         Axis = "DIARY_TOTAL"
	AxisStarTotal          Axis = "STAR_TOTAL"
	AxisRecallTotal        Axis = "RECALL_TOTAL"
	AxisGistDepth          Axis = "GIST_DEPTH"
	AxisForgettingRecovery Axis = "FORGETTING_RECOVERY"
	AxisNeuronSharing      Axis = "NEURON_SHARING"
	AxisMoodVariety        Axis = "MOOD_VARIETY"
	AxisDecoration         Axis = "DECORATION"
)

// axisOrder is the answer order's first key; the catalog slice below follows it.
var axisOrder = []Axis{
	AxisFirstExperience,
	AxisDiaryTotal,
	AxisStarTotal,
	AxisRecallTotal,
	AxisGistDepth,
	AxisForgettingRecovery,
	AxisNeuronSharing,
	AxisMoodVariety,
	AxisDecoration,
}

// The two pinned achievement-only ornament ids. Opaque strings here — that they exist
// and are achievement-only is store's fact, asserted 1:1 at the composition root.
const (
	starTotalCapstoneOrnamentID     = "star_shader.spire"
	neuronSharingCapstoneOrnamentID = "background.floating-lines"
)

func tierReward(tier RewardTier) Reward { return Reward{Tier: tier} }
func ornamentReward(id string) Reward   { return Reward{OrnamentID: id} }
func condition(key CounterKey, target int64) Condition {
	return Condition{Counter: key, Target: target}
}

var catalog = []Achievement{
	// FIRST_EXPERIENCE — one row per first, each target 1 ([A1]: reached by using the product
	// normally, starting with using it once).
	{ID: "first_diary", Axis: AxisFirstExperience, Condition: condition(CounterDiaryWritten, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_star", Axis: AxisFirstExperience, Condition: condition(CounterEpisodicMemoryLaunched, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_recall", Axis: AxisFirstExperience, Condition: condition(CounterRecallPerformed, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_gist_view", Axis: AxisFirstExperience, Condition: condition(CounterGistViewed, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_shared_neuron", Axis: AxisFirstExperience, Condition: condition(CounterNeuronShared, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_release", Axis: AxisFirstExperience, Condition: condition(CounterEpisodicMemoryReleased, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_decoration", Axis: AxisFirstExperience, Condition: condition(CounterDecorationSaved, 1), Reward: tierReward(RewardTier1)},
	{ID: "first_invite", Axis: AxisFirstExperience, Condition: condition(CounterInviteSettled, 1), Reward: tierReward(RewardTier1)},

	// DIARY_TOTAL
	{ID: "diary_5", Axis: AxisDiaryTotal, Condition: condition(CounterDiaryWritten, 5), Reward: tierReward(RewardTier1)},
	{ID: "diary_20", Axis: AxisDiaryTotal, Condition: condition(CounterDiaryWritten, 20), Reward: tierReward(RewardTier2)},
	{ID: "diary_50", Axis: AxisDiaryTotal, Condition: condition(CounterDiaryWritten, 50), Reward: tierReward(RewardTier2)},
	{ID: "diary_200", Axis: AxisDiaryTotal, Condition: condition(CounterDiaryWritten, 200), Reward: tierReward(RewardTier3)},

	// STAR_TOTAL — the capstone pays one of the two achievement-only ornaments.
	{ID: "star_10", Axis: AxisStarTotal, Condition: condition(CounterEpisodicMemoryLaunched, 10), Reward: tierReward(RewardTier1)},
	{ID: "star_50", Axis: AxisStarTotal, Condition: condition(CounterEpisodicMemoryLaunched, 50), Reward: tierReward(RewardTier2)},
	{ID: "star_200", Axis: AxisStarTotal, Condition: condition(CounterEpisodicMemoryLaunched, 200), Reward: tierReward(RewardTier3)},
	{ID: "star_500", Axis: AxisStarTotal, Condition: condition(CounterEpisodicMemoryLaunched, 500), Reward: ornamentReward(starTotalCapstoneOrnamentID)},

	// RECALL_TOTAL
	{ID: "recall_10", Axis: AxisRecallTotal, Condition: condition(CounterRecallPerformed, 10), Reward: tierReward(RewardTier1)},
	{ID: "recall_50", Axis: AxisRecallTotal, Condition: condition(CounterRecallPerformed, 50), Reward: tierReward(RewardTier2)},
	{ID: "recall_200", Axis: AxisRecallTotal, Condition: condition(CounterRecallPerformed, 200), Reward: tierReward(RewardTier2)},
	{ID: "recall_500", Axis: AxisRecallTotal, Condition: condition(CounterRecallPerformed, 500), Reward: tierReward(RewardTier3)},

	// GIST_DEPTH — a reach counter: the deepest gist stage actually viewed (1..4).
	{ID: "gist_stage_1", Axis: AxisGistDepth, Condition: condition(CounterSemanticStageDepth, 1), Reward: tierReward(RewardTier1)},
	{ID: "gist_stage_2", Axis: AxisGistDepth, Condition: condition(CounterSemanticStageDepth, 2), Reward: tierReward(RewardTier2)},
	{ID: "gist_stage_3", Axis: AxisGistDepth, Condition: condition(CounterSemanticStageDepth, 3), Reward: tierReward(RewardTier2)},
	{ID: "gist_stage_4", Axis: AxisGistDepth, Condition: condition(CounterSemanticStageDepth, 4), Reward: tierReward(RewardTier3)},

	// FORGETTING_RECOVERY — recalls whose pre-recall decay stage was deep enough to count
	// (achievement.recovery_decay_stage_min, read at the tracking use-case's memory call site).
	{ID: "recovery_1", Axis: AxisForgettingRecovery, Condition: condition(CounterDecayRecovered, 1), Reward: tierReward(RewardTier1)},
	{ID: "recovery_5", Axis: AxisForgettingRecovery, Condition: condition(CounterDecayRecovered, 5), Reward: tierReward(RewardTier2)},
	{ID: "recovery_20", Axis: AxisForgettingRecovery, Condition: condition(CounterDecayRecovered, 20), Reward: tierReward(RewardTier3)},

	// NEURON_SHARING — the 별자리-규모 axis as [A2] redefines it: the most memories sharing ONE
	// neuron, never a cluster size ([I4]). The capstone pays the other achievement-only ornament.
	{ID: "shared_neuron_3", Axis: AxisNeuronSharing, Condition: condition(CounterNeuronShareDepth, 3), Reward: tierReward(RewardTier2)},
	{ID: "shared_neuron_5", Axis: AxisNeuronSharing, Condition: condition(CounterNeuronShareDepth, 5), Reward: tierReward(RewardTier3)},
	{ID: "shared_neuron_8", Axis: AxisNeuronSharing, Condition: condition(CounterNeuronShareDepth, 8), Reward: ornamentReward(neuronSharingCapstoneOrnamentID)},

	// MOOD_VARIETY — the 13-capstone pays tier-3 stardust, deliberately not an ornament: no
	// palette and no emotion-adjacent thing is ever a reward ([P10] as amended).
	{ID: "mood_variety_5", Axis: AxisMoodVariety, Condition: condition(CounterMoodVariety, 5), Reward: tierReward(RewardTier1)},
	{ID: "mood_variety_9", Axis: AxisMoodVariety, Condition: condition(CounterMoodVariety, 9), Reward: tierReward(RewardTier2)},
	{ID: "mood_variety_13", Axis: AxisMoodVariety, Condition: condition(CounterMoodVariety, 13), Reward: tierReward(RewardTier3)},

	// DECORATION — three counters feed one axis; targets ascend within each counter.
	{ID: "decoration_5", Axis: AxisDecoration, Condition: condition(CounterDecorationSaved, 5), Reward: tierReward(RewardTier1)},
	{ID: "decoration_20", Axis: AxisDecoration, Condition: condition(CounterDecorationSaved, 20), Reward: tierReward(RewardTier2)},
	{ID: "ornament_3", Axis: AxisDecoration, Condition: condition(CounterOrnamentOwned, 3), Reward: tierReward(RewardTier1)},
	{ID: "ornament_8", Axis: AxisDecoration, Condition: condition(CounterOrnamentOwned, 8), Reward: tierReward(RewardTier2)},
	{ID: "ornament_15", Axis: AxisDecoration, Condition: condition(CounterOrnamentOwned, 15), Reward: tierReward(RewardTier2)},
	{ID: "ornament_kind_2", Axis: AxisDecoration, Condition: condition(CounterOrnamentKindVariety, 2), Reward: tierReward(RewardTier1)},
	{ID: "ornament_kind_5", Axis: AxisDecoration, Condition: condition(CounterOrnamentKindVariety, 5), Reward: tierReward(RewardTier3)},
}

// catalogByID indexes the table for lookup. Building it at import makes a duplicate id a panic on
// first import rather than a wrong answer on a user's claim — the store catalog's stance, and the
// reason the index is built rather than the table scanned.
var (
	catalogByID      = indexCatalog()
	catalogByCounter = indexCatalogByCounter()
	// catalogCounterKeys is what the composition root reconciles the producers' emitted keys
	// against — the keys the catalog actually READS, so an orphan key on either side fails the boot.
	catalogCounterKeys = sortedCounterKeys(catalogByCounter)
)

func indexCatalog() map[string]Achievement {
	index := make(map[string]Achievement, len(catalog))
	for _, row := range catalog {
		if _, duplicate := index[row.ID]; duplicate {
			panic("achievement: catalog id " + row.ID + " is declared twice")
		}
		index[row.ID] = row
	}
	return index
}

// Catalog is every row in the one server-fixed order. It is the only way to enumerate the catalog
// from outside this package — the ornament pairing test and the read both go through it. The read
// itself walks the package-level table instead, so the hot path copies nothing.
func Catalog() []Achievement {
	return slices.Clone(catalog)
}

// indexCatalogByCounter groups the rows a counter's value is evaluated against. Order follows the
// table, so the candidates of one axis stay in ascending-target order.
func indexCatalogByCounter() map[CounterKey][]Achievement {
	index := map[CounterKey][]Achievement{}
	for _, row := range catalog {
		index[row.Condition.Counter] = append(index[row.Condition.Counter], row)
	}
	return index
}

func sortedCounterKeys(index map[CounterKey][]Achievement) []CounterKey {
	keys := make([]CounterKey, 0, len(index))
	for key := range index {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

// LookupAchievement resolves one row; false for an id the catalog does not publish.
func LookupAchievement(id string) (Achievement, bool) {
	row, ok := catalogByID[id]
	return row, ok
}

// AchievementsByCounter is the candidate set a counter write is evaluated against — one axis's tiers,
// in ascending-target order. An empty result is a no-op, and the boot reconciliation makes that
// branch dead in a correct build.
func AchievementsByCounter(key CounterKey) []Achievement {
	return catalogByCounter[key]
}

// CatalogCounterKeys is every counter the catalog reads. The composition root asserts set equality
// against the union of the producers' emitted keys, in both directions — a renamed key, an orphan
// key, or a catalog row reading a key nobody emits cannot start the server.
func CatalogCounterKeys() []CounterKey {
	return slices.Clone(catalogCounterKeys)
}
