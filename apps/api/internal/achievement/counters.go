package achievement

import "slices"

// The closed counter vocabulary ([A2][A1a]). Every condition reads exactly one of these keys, and
// the accumulation MODE lives here in the definition, never at a call site: a producer pushes
// (counterKey, delta) and has no field in which to invent a third semantics. The set is exported
// (KnownCounterKey / CounterModeOf / the family lists) so the composition root — the one package
// that sees every context — can assert each producer's local key constant is a member without any
// context importing this one; at runtime an unknown key is ErrUnknownCounterKey and fails its
// transaction, which is safe precisely because the membership test makes a typo a test failure
// first.
//
// No key counts a cluster or a connected component of the synapse graph ([I4] — an emergent
// structure has no type and no table): neuron_share_depth is
// activations on ONE Neuron, a stored row. And no key reads a mood's identity as a condition —
// the mood_recorded family feeds only the variety count, so no achievement can privilege one
// emotion over another ([M3] spirit).

// CounterKey is a member of the closed vocabulary below. Opaque outside this package.
type CounterKey string

// CounterMode is how a delta lands on the stored value: accumulate adds, reach keeps the
// high-water mark (GREATEST) — which is how "단계 도달" is expressed without a rate or a window.
type CounterMode string

const (
	CounterModeAccumulate CounterMode = "accumulate"
	CounterModeReach      CounterMode = "reach"
)

// The twelve producer-pushed keys (recorded by the producing contexts, one constant per call site).
const (
	CounterDiaryWritten           CounterKey = "diary_written"
	CounterEpisodicMemoryLaunched CounterKey = "episodic_memory_launched"
	CounterRecallPerformed        CounterKey = "recall_performed"
	CounterGistViewed             CounterKey = "gist_viewed"
	CounterSemanticStageDepth     CounterKey = "semantic_stage_depth"
	CounterDecayRecovered         CounterKey = "decay_recovered"
	CounterNeuronShared           CounterKey = "neuron_shared"
	CounterNeuronShareDepth       CounterKey = "neuron_share_depth"
	CounterEpisodicMemoryReleased CounterKey = "episodic_memory_released"
	CounterDecorationSaved        CounterKey = "decoration_saved"
	CounterOrnamentOwned          CounterKey = "ornament_owned"
	CounterInviteSettled          CounterKey = "invite_settled"
)

// The two derived variety counters, maintained by this context itself (the closed exception to
// "producers push everything"): bumped by one exactly when a family member's counter row is first
// created (the ON CONFLICT DO NOTHING first-touch signal), so distinctness never needs a second
// condition kind and each ceiling is its family's length by construction ([M2][A2]).
const (
	CounterMoodVariety         CounterKey = "mood_variety"
	CounterOrnamentKindVariety CounterKey = "ornament_kind_variety"
)

const (
	moodRecordedPrefix          = "mood_recorded:"
	ornamentKindDecoratedPrefix = "ornament_kind_decorated:"
)

// moodRecordedMembers mirrors the product's 13 moods ([M2]). This context cannot import the mood
// vocabulary (it lives in memory / packages/emotion), so the composition root asserts this family
// equals memory's AllMoods 1:1 — the same one-file drift guard shape store uses for ornament ids.
var moodRecordedMembers = []string{
	"JOY", "CALM", "SAD", "ANGER", "FEAR", "LOVE", "NEUTRAL",
	"EXCITEMENT", "GRATITUDE", "RELIEF", "STRESS", "TIRED", "EMPTINESS",
}

// ornamentKindDecoratedMembers mirrors store's closed OrnamentKind set, asserted 1:1 at the
// composition root the same way.
var ornamentKindDecoratedMembers = []string{"BACKGROUND", "STAR_SHADER"}

// The families and their indexes are built once at import, not per call: every lookup below is on a
// path the tracking use-case's RecordProgress takes for EVERY counter write, so rebuilding a slice
// to answer "which variety counter does this key feed" would allocate on every diary, launch and
// save. Same shape as the store catalog's one-time build.
var (
	moodRecordedFamily          = buildFamily(moodRecordedPrefix, moodRecordedMembers)
	ornamentKindDecoratedFamily = buildFamily(ornamentKindDecoratedPrefix, ornamentKindDecoratedMembers)
	counterModes                = buildCounterModes()
	// varietyCounterByMember is what a first touch is resolved through: a family member bumps its
	// family's variety counter in the same transaction. Non-family keys are absent, so only family
	// first-touches can ever move a variety count.
	varietyCounterByMember = map[CounterKey]CounterKey{}
)

// family is one key family: its members in declaration order, and the member-value index the
// producer-facing constructors resolve through.
type family struct {
	keys     []CounterKey
	byMember map[string]CounterKey
}

func buildFamily(prefix string, members []string) family {
	built := family{
		keys:     make([]CounterKey, 0, len(members)),
		byMember: make(map[string]CounterKey, len(members)),
	}
	for _, member := range members {
		key := CounterKey(prefix + member)
		built.keys = append(built.keys, key)
		built.byMember[member] = key
	}
	return built
}

func init() {
	for variety, group := range map[CounterKey]family{
		CounterMoodVariety:         moodRecordedFamily,
		CounterOrnamentKindVariety: ornamentKindDecoratedFamily,
	} {
		for _, key := range group.keys {
			varietyCounterByMember[key] = variety
		}
	}
}

func buildCounterModes() map[CounterKey]CounterMode {
	modes := map[CounterKey]CounterMode{
		CounterDiaryWritten:           CounterModeAccumulate,
		CounterEpisodicMemoryLaunched: CounterModeAccumulate,
		CounterRecallPerformed:        CounterModeAccumulate,
		CounterGistViewed:             CounterModeAccumulate,
		CounterSemanticStageDepth:     CounterModeReach,
		CounterDecayRecovered:         CounterModeAccumulate,
		CounterNeuronShared:           CounterModeAccumulate,
		CounterNeuronShareDepth:       CounterModeReach,
		CounterEpisodicMemoryReleased: CounterModeAccumulate,
		CounterDecorationSaved:        CounterModeAccumulate,
		CounterOrnamentOwned:          CounterModeReach,
		CounterInviteSettled:          CounterModeAccumulate,
		CounterMoodVariety:            CounterModeAccumulate,
		CounterOrnamentKindVariety:    CounterModeAccumulate,
	}
	for _, group := range []family{moodRecordedFamily, ornamentKindDecoratedFamily} {
		for _, key := range group.keys {
			modes[key] = CounterModeAccumulate
		}
	}
	return modes
}

// KnownCounterKey answers membership in the closed set.
func KnownCounterKey(key CounterKey) bool {
	_, ok := counterModes[key]
	return ok
}

// CounterModeOf resolves a key's accumulation mode; false for anything outside the closed set.
func CounterModeOf(key CounterKey) (CounterMode, bool) {
	mode, ok := counterModes[key]
	return mode, ok
}

// MoodRecordedFamily is the 13-member mood_recorded:<MOOD> key family, in mood order.
func MoodRecordedFamily() []CounterKey {
	return slices.Clone(moodRecordedFamily.keys)
}

// OrnamentKindDecoratedFamily is the ornament_kind_decorated:<KIND> key family, one member per
// store OrnamentKind.
func OrnamentKindDecoratedFamily() []CounterKey {
	return slices.Clone(ornamentKindDecoratedFamily.keys)
}

// MoodRecordedCounterKey resolves the family key for one mood value; false for a mood outside the
// closed family, so a producer cannot mint a fourteenth member.
func MoodRecordedCounterKey(mood string) (CounterKey, bool) {
	key, ok := moodRecordedFamily.byMember[mood]
	return key, ok
}

// OrnamentKindDecoratedCounterKey resolves the family key for one ornament kind; false outside the
// closed family.
func OrnamentKindDecoratedCounterKey(kind string) (CounterKey, bool) {
	key, ok := ornamentKindDecoratedFamily.byMember[kind]
	return key, ok
}

// DerivedCounterKey answers whether a key is one this context maintains itself. A producer pushing
// one directly would be counting distinctness it cannot prove — thirteen JOY entries would read as
// thirteen moods — so the recorder path refuses these keys and derives them from family
// first-touches instead.
func DerivedCounterKey(key CounterKey) bool {
	return key == CounterMoodVariety || key == CounterOrnamentKindVariety
}

// VarietyCounterFor maps a family member key to the variety counter its first touch bumps; false
// for every non-family key, so only family first-touches ever move a variety count.
func VarietyCounterFor(key CounterKey) (CounterKey, bool) {
	variety, ok := varietyCounterByMember[key]
	return variety, ok
}
