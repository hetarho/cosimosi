package memory

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// The release use-case's consumer-owned ports (§2.4). Declared HERE because
// Release/Restore/SuggestLetGo/LetGo and the retention sweep are the primary consumers: the
// AI seal-suggester, the release repository (the ledger + restore + candidate reads + the
// sweep, plus the shared sealing concretes it reuses in one transaction). Domain-shaped in
// and out — no proto, sqlc, pgx, or SDK type crosses any of them. The AI can only reference a
// pre-filtered candidate id; orphan-ness and approved-id validity are server decisions (§2.9#8).

// MemorySummary is the read-only view of a memory the SealSuggester sees — enough to reason
// about which meanings to offer, never a field it could write back. Domain-shaped.
type MemorySummary struct {
	Name        string
	CurrentText string
	Mood        Mood
}

// SealCandidateRef is one this-memory-only semantic neuron offered to the SealSuggester as a
// seal candidate: the id the AI may reference and a human name for the prompt/UI. The AI's
// output can reference only these ids — it has no field for a shared or foreign id or a
// seal command ([X6], the structural half of "AI suggests only").
type SealCandidateRef struct {
	NeuronID string
	Name     string
}

// SealSuggestion is the SealSuggester's schema-forced output: a ranking/selection over the
// offered candidates, each with a short human reason for the UI. It carries no command and no
// reference outside the offered set — the use-case still intersects it with the offered ids.
type SealSuggestion struct {
	Candidates []SealCandidate
}

// SealCandidate is one suggested this-memory-only semantic neuron to review: the id, its name,
// and the reason the AI gives. Never a shared, spatial, entity, emotion, or color reference.
type SealCandidate struct {
	NeuronID string
	Name     string
	Reason   string
}

// HeavyState is the [X7] server-derived signal SuggestLetGo returns for the delete UI to
// surface a gentle, non-blocking professional-resource notice. It claims no efficacy and is a
// v1-conservative reserved-slot heuristic (default Detected=false); the notice UI is not this
// unit's.
type HeavyState struct {
	Detected bool
	Severity string
}

// SuggestLetGoResult is SuggestLetGo's return: the candidates the user reviews plus the heavy
// hint. It persists nothing.
type SuggestLetGoResult struct {
	Candidates []SealCandidate
	HeavyState HeavyState
}

// ReleaseResult is Release's return ([X1][X2]): the released diary, its soft-deleted memory ids,
// and the real-clock UTC deleted_at that starts the restore window.
type ReleaseResult struct {
	DiaryID           string
	EpisodicMemoryIDs []string
	DeletedAt         time.Time
}

// RestoreResult is Restore's return: the diary and the memory ids returned to full participation.
type RestoreResult struct {
	DiaryID           string
	EpisodicMemoryIDs []string
}

// LetGoResult is LetGo's return: the neurons actually sealed (the approved subset that passed
// server-side re-validation).
type LetGoResult struct {
	SealedNeuronIDs []string
}

// ReleaseGroup is one live release record read for the guard/restore/sweep: the ledger id, the
// released diary, and the real-clock UTC deleted_at.
type ReleaseGroup struct {
	ID        string
	DiaryID   string
	DeletedAt time.Time
}

// SynapseDelta is one edge and the LTD amount a Release removed from it — recorded in the ledger
// so Restore can reverse exactly.
type SynapseDelta struct {
	SynapseID    string
	AppliedDelta float64
}

// SealSuggester is the consumer-owned AI port ([X6], §2.4/§2.8): given the memory, the user's
// words, and the pre-filtered this-memory-only semantic candidate set, it returns a schema-forced
// ranking/selection of candidate references. It is structurally unable to emit a delete/seal
// command or a shared or foreign reference — the concrete adapter + keyless mock live behind
// the AI seam and are cost-metered. Domain-shaped in/out only.
type SealSuggester interface {
	Suggest(ctx context.Context, memory MemorySummary, words string, candidates []SealCandidateRef) (SealSuggestion, error)
}

// ReleaseRepo is the release use-case's repository. InReleaseTx runs the atomic
// release/restore/letgo/sweep write set as one transaction (the recall repo-owned tx precedent);
// the two standalone reads back SuggestLetGo, which persists nothing so it takes no transaction.
type ReleaseRepo interface {
	InReleaseTx(ctx context.Context, fn func(tx ReleaseTx) error) error
	// EpisodicMemoryForRelease loads a memory for the letting-go read (name/text/emotion +
	// soft-delete state); ErrReleaseMemoryNotFound when it is not the caller's or does not exist.
	EpisodicMemoryForRelease(ctx context.Context, scope platform.UserScope, memoryID string) (EpisodicMemory, error)
	// ThisMemoryOnlySemanticNeurons returns the unsealed semantic neurons this memory activates
	// that no OTHER live memory activates — the safe letting-go candidate set ([X4]).
	ThisMemoryOnlySemanticNeurons(ctx context.Context, scope platform.UserScope, memoryID string) ([]SealCandidateRef, error)
}

// ReleaseTx is the transaction-scoped surface Release/Restore/LetGo and the retention sweep
// consume. It embeds the shared sealing concretes (reused, never redefined) alongside the
// release ledger writes/reads, the restore reversal writes, and the sweep's user-scoped,
// release-group-bound deletes. Method names match the memory/pg concrete, which implements this
// implicitly. It exposes NO Diary UPDATE — the only Diary mutation is the sweep's whole-row
// delete ([I2]).
type ReleaseTx interface {
	GraphMutationLocker
	// The shared sealing/soft-delete/classification concretes (reused).
	SoftDeleteDiaryMemories(ctx context.Context, scope platform.UserScope, diaryID string, deletedAt time.Time) ([]string, error)
	RemovalNeuronIDs(ctx context.Context, scope platform.UserScope, memoryIDs []string, neuronType *NeuronType) ([]string, error)
	RetainedNeuronActivationFacts(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]NeuronActivationFact, error)
	SealNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string, sealedAt time.Time) ([]string, error)
	// WeakenSharedContributions is the combined shared-neuron LTD, used by LetGo (which keeps
	// no ledger). Release uses the delta-returning variant below instead.
	WeakenSharedContributions(ctx context.Context, scope platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) error
	// WeakenSharedContributionsReturningDeltas Depresses each shared contribution synapse and
	// returns the amount removed per edge — Release records these in the ledger for exact restore.
	WeakenSharedContributionsReturningDeltas(ctx context.Context, scope platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) ([]SynapseDelta, error)

	// EpisodicMemoryForRelease loads a memory inside the transaction (LetGo's liveness re-check).
	EpisodicMemoryForRelease(ctx context.Context, scope platform.UserScope, memoryID string) (EpisodicMemory, error)
	// ThisMemoryOnlySemanticNeuronIDs is LetGo's server-side re-validation set (sealed-inclusive so a
	// re-approval is an idempotent no-op); a shared/foreign/non-semantic id is absent and rejected.
	ThisMemoryOnlySemanticNeuronIDs(ctx context.Context, scope platform.UserScope, memoryID string) ([]string, error)

	// Release ledger writes + the already-released guard read.
	ReleaseGroupForDiary(ctx context.Context, scope platform.UserScope, diaryID string) (ReleaseGroup, bool, error)
	ReleaseGroupForSweep(ctx context.Context, scope platform.UserScope, releaseID string) (ReleaseGroup, bool, error)
	InsertReleaseGroup(ctx context.Context, scope platform.UserScope, group ReleaseGroup) error
	RecordReleaseMemories(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs []string) error
	RecordReleaseSealedNeurons(ctx context.Context, scope platform.UserScope, releaseID string, neuronIDs []string, sealedAt time.Time) error
	RecordReleaseSynapseDeltas(ctx context.Context, scope platform.UserScope, releaseID string, deltas []SynapseDelta) error

	// Restore reads + reversal writes.
	ReleaseMemories(ctx context.Context, scope platform.UserScope, releaseID string) ([]string, error)
	ClearReleaseMemoriesDeletedAt(ctx context.Context, scope platform.UserScope, memoryIDs []string) error
	// ReleaseMemoryNeuronSealFacts locks the current facts for every neuron activated by
	// this release's memories. The use-case applies the pure reclassification policy before
	// calling the two narrow writes below.
	ReleaseMemoryNeuronSealFacts(ctx context.Context, scope platform.UserScope, releaseID string) ([]NeuronSealFact, error)
	DeleteReleaseNeuronSealEffects(ctx context.Context, scope platform.UserScope, neuronIDs []string) error
	UnsealReleaseOwnedNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) error
	// ReverseReleaseSynapseDeltas adds each recorded LTD amount back to the edge's current strength
	// atomically (lost-update-safe) — the exact reversal of Release's contribution Depress.
	ReverseReleaseSynapseDeltas(ctx context.Context, scope platform.UserScope, releaseID string) error
	CancelReleaseMemoryJobs(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs []string, cancelledAt time.Time) error
	RequeueReleaseMemoryJobs(ctx context.Context, scope platform.UserScope, releaseID string, nextRunAt time.Time) error
	DeleteReleaseRetentionJobs(ctx context.Context, scope platform.UserScope, releaseID string) error
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
	DeleteReleaseGroup(ctx context.Context, scope platform.UserScope, releaseID string) error

	// Retention sweep reads + the FK-safe hard deletes (the only hard delete of user data, [I1]).
	ExpiredReleaseGroups(ctx context.Context, scope platform.UserScope, cutoff time.Time) ([]ReleaseGroup, error)
	ExclusiveReleaseNeurons(ctx context.Context, scope platform.UserScope, releaseID string, releaseMemoryIDs []string) ([]string, error)
	PurgeReleaseJobs(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs, neuronIDs []string) error
	DeleteReleaseActivations(ctx context.Context, scope platform.UserScope, memoryIDs []string) error
	DeleteReleaseSynapses(ctx context.Context, scope platform.UserScope, neuronIDs []string) error
	DeleteReleaseEmbeddings(ctx context.Context, scope platform.UserScope, neuronIDs []string) error
	DeleteReleaseNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) error
	DeleteReleaseMemories(ctx context.Context, scope platform.UserScope, memoryIDs []string) error
	DeleteReleaseDiary(ctx context.Context, scope platform.UserScope, diaryID string) error
}
