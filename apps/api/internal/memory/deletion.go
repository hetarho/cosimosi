package memory

// Deletion rules ([X1][X4]) — the pure domain of the only two ways a memory ever leaves the
// universe. The system NEVER originates deletion ([I1]); the sole removal is the user's explicit choice,
// and even then shared neurons are preserved — only the removed memories' synaptic contribution is
// weakened. There are two removals, differing only in which neurons enter the classification:
//
//   - Full delete: soft-delete every EpisodicMemory born from a Diary (deleted_at), then classify the
//     union of their neurons — seal the orphans (sealed_at), keep the shared, and Depress the removed
//     memories' contribution on the shared neurons' synapses. The Diary itself is never mutated ([I2]);
//     the memory rows persist for the restore window (the release sweep owns any hard delete).
//   - Letting-go: classify one memory's SEMANTIC neurons only — seal orphans, keep + weaken shared. The
//     memory is NOT soft-deleted and its emotion columns + seed are untouched, so it persists as a
//     content-less silent engram; spatial/entity/emotion/color are out of reach ([X4][I11]).
//
// This unit is server-authoritative, not FE↔BE golden-parity (A9): a removal reaches the client only by
// facts disappearing from GetUniverse. It declares no ports and no orchestration — the Release/LetGo
// use-cases own the transaction and the consumer-owned interfaces the memory/pg concretes satisfy.
//
// # The canonical alive-predicate ([X3], A6)
//
// One "is this fact alive?" test, reused at every read and every compute so a sealed/soft-deleted fact
// exerts no force, decays for nobody, consolidates into nothing, and never renders — no ghost that pulls
// while invisible:
//
//   - a memory is alive iff deleted_at IS NULL;
//   - a neuron is alive iff sealed_at IS NULL;
//   - a synapse is alive iff BOTH endpoint neurons are alive;
//   - an activation is alive iff its memory AND its neuron are alive — exclusion is TRANSITIVE through
//     deleted_at / sealed_at, so neuron_activations needs no column of its own (A10).
//
// The predicate lives as `deleted_at IS NULL` / `sealed_at IS NULL` JOIN/WHERE clauses in memory/pg's
// queries (the only sqlc/pgx seam); this comment is its single source of intent. Deletion weakening uses
// Depress (LTD, associative/local) and NEVER Downscale (SHY, sleep-time homeostatic renormalization) — a
// distinct mechanism ([I9], A8).

// NeuronClass is the seal-vs-keep decision for one neuron in a removal.
type NeuronClass string

const (
	// NeuronClassOrphan — no retained memory outside the removal set still activates the neuron, so it is
	// sealed; its edges then leave every dynamic via the alive-predicate.
	NeuronClassOrphan NeuronClass = "orphan"
	// NeuronClassShared — at least one retained memory outside the removal set still activates the neuron, so
	// it is kept; only the removed memories' contribution to its synapses is Depressed.
	NeuronClassShared NeuronClass = "shared"
)

// NeuronActivationFact is one retained (neuron, memory) activation edge supplied by memory/pg for
// classification. A row exists for both a live memory and a soft-deleted memory still awaiting its
// retention sweep; a swept memory has no activation row. Encoding retained ownership structurally keeps
// overlapping release effects compositional instead of making callers reinterpret deleted_at.
type NeuronActivationFact struct {
	NeuronID         string
	EpisodicMemoryID string
}

// NeuronSealFact is the locked, persistence-neutral input for reclassifying seals when a retained
// release memory is restored or another overlapping release is swept. ReleaseOwnsCurrentSeal is true
// only when a release-effect timestamp matches the neuron's current seal; a later LetGo seal therefore
// remains distinguishable even while a stale release-effect row still exists.
type NeuronSealFact struct {
	NeuronID               string
	RepresentationRevision int64
	Sealed                 bool
	HasReleaseEffect       bool
	ReleaseOwnsCurrentSeal bool
}

// NeuronRevision is the identity/revision pair used to regenerate deletion-safe derived state after
// Restore. It deliberately carries no source text.
type NeuronRevision struct {
	NeuronID               string
	RepresentationRevision int64
}

// NeuronSealReclassification is the pure decision produced from locked seal facts. Release effects
// can be retired without unsealing when a newer permanent seal replaced them.
type NeuronSealReclassification struct {
	RetireReleaseEffectIDs []string
	UnsealNeuronIDs        []string
	Reembed                []NeuronRevision
}

// ReclassifyRetainedNeuronSeals composes release ownership with permanent LetGo semantics. Any
// release effect conflicts with a retained owner and is retired. The current seal is reversed only
// when its timestamp is owned by a release effect; an unsealed or newly release-unsealed neuron is
// eligible for re-embedding, while a permanent LetGo seal remains sealed and absent from that work.
func ReclassifyRetainedNeuronSeals(facts []NeuronSealFact) NeuronSealReclassification {
	plan := NeuronSealReclassification{
		RetireReleaseEffectIDs: make([]string, 0, len(facts)),
		UnsealNeuronIDs:        make([]string, 0, len(facts)),
		Reembed:                make([]NeuronRevision, 0, len(facts)),
	}
	seen := make(map[string]bool, len(facts))
	for _, fact := range facts {
		if fact.NeuronID == "" || seen[fact.NeuronID] {
			continue
		}
		seen[fact.NeuronID] = true
		if fact.HasReleaseEffect {
			plan.RetireReleaseEffectIDs = append(plan.RetireReleaseEffectIDs, fact.NeuronID)
		}
		if fact.Sealed && fact.ReleaseOwnsCurrentSeal {
			plan.UnsealNeuronIDs = append(plan.UnsealNeuronIDs, fact.NeuronID)
		}
		if !fact.Sealed || fact.ReleaseOwnsCurrentSeal {
			plan.Reembed = append(plan.Reembed, NeuronRevision{
				NeuronID:               fact.NeuronID,
				RepresentationRevision: fact.RepresentationRevision,
			})
		}
	}
	return plan
}

// ClassifyNeurons partitions a removal set's neurons into orphan (seal) and shared (keep + weaken),
// evaluated as-of removal (A1). A neuron is shared iff at least one retained activation ties it to a
// memory outside the removal set; soft-deleted rows remain owners until Sweep removes their activation.
// Otherwise it is an orphan. Deterministic and IO-free — the retained-owner facts come from memory/pg,
// the decision is domain math. The result preserves input order and never allocates a neuron twice.
func ClassifyNeurons(removalMemoryIDs, neuronIDs []string, facts []NeuronActivationFact) (orphans, shared []string) {
	inRemoval := make(map[string]bool, len(removalMemoryIDs))
	for _, id := range removalMemoryIDs {
		inRemoval[id] = true
	}
	sharedByNeuron := make(map[string]bool, len(neuronIDs))
	for _, fact := range facts {
		if inRemoval[fact.EpisodicMemoryID] {
			continue
		}
		sharedByNeuron[fact.NeuronID] = true
	}
	orphans = make([]string, 0, len(neuronIDs))
	shared = make([]string, 0, len(neuronIDs))
	for _, neuronID := range neuronIDs {
		if sharedByNeuron[neuronID] {
			shared = append(shared, neuronID)
		} else {
			orphans = append(orphans, neuronID)
		}
	}
	return orphans, shared
}
