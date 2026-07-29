package memory

// The achievement counter facts this context reports. Their spelling and their accumulate/reach mode
// belong to the achievement catalog; this context only emits them, through a port whose payload is a
// key and a delta. The keys are canonical UL nouns and carry NO rendering word — the launch counter
// is `episodic_memory_launched`, never `star_launched` (UL §4).
//
// They are constants rather than literals at the call sites, and AchievementCounterKeys publishes
// the set, because the composition root reconciles this set against the keys the catalog reads and
// refuses to boot on a difference in either direction. A producing context cannot import the
// catalog's constants, so this list is the only thing that can be compared.
const (
	// CounterDiaryWritten counts diaries that launched at least one EpisodicMemory — one per diary,
	// never per memory, so splitting a diary cannot inflate it.
	CounterDiaryWritten = "diary_written"
	// CounterEpisodicMemoryLaunched counts the EpisodicMemory rows a launch created.
	CounterEpisodicMemoryLaunched = "episodic_memory_launched"
	// CounterNeuronShared counts neurons reaching their SECOND activation — the moment a neuron
	// starts being shared, reported once per neuron because the count crosses 2 exactly once.
	CounterNeuronShared = "neuron_shared"
	// CounterNeuronShareDepth is a reach counter: the most memories now sharing one Neuron. It
	// counts activations on a stored row, never a cluster of the synapse graph ([I4]).
	CounterNeuronShareDepth = "neuron_share_depth"
	// CounterRecallPerformed counts recalled memories — a whole-diary recall counts each member,
	// matching the ledger's one-recall-row-per-member shape.
	CounterRecallPerformed = "recall_performed"
	// CounterDecayRecovered counts recalls of a memory whose PRE-recall decay stage had reached
	// values.AchievementRecoveryDecayStageMin — the 망각·회복 fact. The stage itself never crosses
	// the port; only the resulting count does.
	CounterDecayRecovered = "decay_recovered"
	// CounterGistViewed counts 요지 별 열람.
	CounterGistViewed = "gist_viewed"
	// CounterSemanticStageDepth is a reach counter: the deepest gist stage actually served.
	CounterSemanticStageDepth = "semantic_stage_depth"
	// CounterEpisodicMemoryReleased counts 놓아주기 — soft-deleted memories. LetGo seals neurons and
	// releases nothing, so it emits none.
	CounterEpisodicMemoryReleased = "episodic_memory_released"
	// counterMoodRecordedPrefix + MOOD counts a memory recorded with that mood. The member is built
	// from the closed mood enum, never from input, so no caller can invent a counter key; the
	// distinct-mood COUNT is derived by the counter table's owner, not here.
	counterMoodRecordedPrefix = "mood_recorded:"
)

// CounterMoodRecorded is the family key for one mood. Unexported prefix + a closed-enum member is
// what keeps the family closed at its 13 members.
func CounterMoodRecorded(mood Mood) string {
	return counterMoodRecordedPrefix + string(mood)
}

// AchievementCounterKeys is every key this context can emit, families expanded. The composition
// root reconciles it against the catalog's read set at boot.
func AchievementCounterKeys() []string {
	keys := []string{
		CounterDiaryWritten,
		CounterEpisodicMemoryLaunched,
		CounterNeuronShared,
		CounterNeuronShareDepth,
		CounterRecallPerformed,
		CounterDecayRecovered,
		CounterGistViewed,
		CounterSemanticStageDepth,
		CounterEpisodicMemoryReleased,
	}
	for _, mood := range AllMoods() {
		keys = append(keys, CounterMoodRecorded(mood))
	}
	return keys
}
