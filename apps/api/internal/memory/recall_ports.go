package memory

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// The recall use-case's consumer-owned ports (§2.4). Declared HERE because recall is
// the primary consumer of each: the Twinkle spend gate, the provenance append, and
// the recall-side repository surface. The reconsolidation rules declared none — they
// are pure domain with no IO — so these are the first recall ports.
// Domain-shaped in and out: no proto, sqlc, pgx, or SDK type crosses any of them.

// ErrInsufficientTwinkle is the canonical denial a SpendGate returns when the caller
// cannot afford the action ([G1], §CC2). Recall/RecallDiaryStars surface it verbatim
// so the transport maps one code and the UI shows one message; the no-op gate never
// returns it (it charges nothing), the real economy gate does.
var ErrInsufficientTwinkle = errors.New("insufficient twinkle for this action")

// SpendKind names WHICH metered action a SpendIntent is for. It is a depth/kind
// SIGNAL, never a price: the gate maps a kind (+ its target and gist depth) to a
// cost via the cost curve, so no price literal ever lives in this context (§CC2).
// recall = 회고하기; view_gist = 요지 열람 (the paired gist-view consumer).
type SpendKind string

const (
	SpendKindRecall   SpendKind = "recall"
	SpendKindViewGist SpendKind = "view_gist"
)

// SpendIntent tells the SpendGate what is being spent on: the action kind, the target
// memory, and — for a gist view — the gist stage whose depth prices it ([R8][G4]).
// It carries NO price: the recall side supplies the accessibility/depth signal and
// the gate decides the cost and whether the balance allows it (§CC2). Stage is unused
// (0) for a recall.
type SpendIntent struct {
	Kind     SpendKind
	MemoryID string
	Stage    int16
}

// RecallSpendIntent is the recall action's intent — the target memory, no price.
func RecallSpendIntent(memoryID string) SpendIntent {
	return SpendIntent{Kind: SpendKindRecall, MemoryID: memoryID}
}

// SpendGate is the consumer-owned check-and-spend port ([G1], §2.4). Declared ONCE
// here and shared with the gist-view use-case — the two are the only spend actions in
// v1. The shipped default is an allow-all no-op (AllowAllSpendGate) so the recall loop
// works with no economy; the real balance-check + deduct rebinds it at the composition
// root. A denial returns ErrInsufficientTwinkle and, because the whole recall is one
// transaction, resets nothing (§CC2). The gate never sees a price — only the
// SpendIntent's kind/target/depth signal.
type SpendGate interface {
	CheckAndSpend(ctx context.Context, scope platform.UserScope, spend SpendIntent) error
}

// MemoryProvenanceStore appends one append-only 변천사 row ([R8a]). Consumer-owned by
// recall (Reconsolidate is the writer); the concrete is memory/pg's AppendMemoryProvenance,
// so the method name matches it implicitly. Embedded in RecallTx so the append joins the
// recall transaction — a reconsolidation and its provenance row land wholly or not at all
// ([I2] keeps the Diary out of that write set).
type MemoryProvenanceStore interface {
	AppendMemoryProvenance(ctx context.Context, scope platform.UserScope, entry MemoryProvenance) error
}

// ForgettingOffsetStore applies the neighbor forgetting ± ([R5]) to a recalled memory's
// NEIGHBORS only (the memory itself recovers wholly [F5] and is never in memoryIDs).
// Consumer-owned by recall; the concrete is memory/pg's AddForgettingOffset. Embedded in
// RecallTx so the nudge is part of the recall transaction.
type ForgettingOffsetStore interface {
	AddForgettingOffset(ctx context.Context, scope platform.UserScope, memoryIDs []string, delta float64) error
}

// RecallRepo runs the single recall transaction: everything fn writes — the sync
// advance, the anchor reset, the batch LTP, the neighbor ±, the reconsolidation
// text/seed, the regen enqueue, and the provenance row — commits wholly or not at all.
type RecallRepo interface {
	InRecallTx(ctx context.Context, fn func(tx RecallTx) error) error
}

// RecallTx is the transaction-scoped surface Recall/Reinforce/Reconsolidate consume.
// It embeds ProgressionTx (the clock + job queue) so the sync-to-today advance and the
// remaining-stage regen enqueue run on the recall transaction, and the two write ports
// so the neighbor ± and provenance append do too. It deliberately exposes NO Diary write
// and NO delete, so the recall path cannot express an [I1]/[I2] violation. Method names
// match the memory/pg concrete, which implements this implicitly.
type RecallTx interface {
	ProgressionTx
	MemoryProvenanceStore
	ForgettingOffsetStore
	// EpisodicMemoryForRecall loads the memory being recalled with the state the branch
	// needs: current_text/seed for the compare + reshape, and semantic_stage/
	// semantic_stages for the remaining-stage selection ([C7]). Returns
	// ErrRecallMemoryNotFound when no such row is the caller's.
	EpisodicMemoryForRecall(ctx context.Context, scope platform.UserScope, memoryID string) (EpisodicMemory, error)
	// RecallMemberNeurons returns the recalled memory's live member neurons (id, name,
	// type) — the semanticize inputs the reconsolidation regen job carries.
	RecallMemberNeurons(ctx context.Context, scope platform.UserScope, memoryID string) ([]ExistingNeuron, error)
	// RecallMemberSynapses returns every synapse whose BOTH endpoints are the recalled
	// memory's member neurons — the co-activated edges Reinforce batch-LTPs ([R3]). Only
	// neuron↔neuron edges exist, so no memory↔memory edge can be returned ([I4][I6]).
	RecallMemberSynapses(ctx context.Context, scope platform.UserScope, memoryID string) ([]Synapse, error)
	// LiveDiaryMemoryIDs returns the still-live (soft-delete-excluded) episodic
	// memories born from a diary — the whole-diary recall set ([D3]).
	LiveDiaryMemoryIDs(ctx context.Context, scope platform.UserScope, diaryID string) ([]string, error)
	// NeighborSharedSemanticCounts returns, for each NEIGHBOR episodic memory (never
	// the recalled memory), the count of SEMANTIC neurons it shares with the recalled
	// memory — spatial/entity excluded, emotion never a neuron ([I3][R5]). The count
	// feeds NeighborForgettingDelta.
	NeighborSharedSemanticCounts(ctx context.Context, scope platform.UserScope, memoryID string) ([]NeighborSharedSemanticCount, error)
	// ResetRecallAnchors resets the recall anchors in one write ([R2][R3][C6a]):
	// last_recalled_universe_time = universeTime, recall_count += 1,
	// semanticize_timer_reset_at = universeTime. It returns the post-increment
	// recall_count and the stored base_strength so the caller derives the bumped
	// EffectiveStrength, and ErrRecallMemoryNotFound if the row vanished.
	ResetRecallAnchors(ctx context.Context, scope platform.UserScope, memoryID string, universeTime time.Time) (RecallAnchors, error)
	// ApplyReconsolidatedText writes ONLY the reconsolidation representation deltas —
	// current_text and seed ([R6][V5]). Never the Diary ([I2]). Plain recall never
	// calls it ([R4]).
	ApplyReconsolidatedText(ctx context.Context, scope platform.UserScope, memoryID string, currentText string, seed int64) error
	SynapseWriter
}

// SynapseWriter is the single synapse-write method Reinforce's batch LTP uses. It is a
// one-method view of the launch-side SynapseStore's UpsertSynapse so RecallTx pulls in
// only the write it needs, not the launch-time reads. The pg concrete satisfies both.
type SynapseWriter interface {
	UpsertSynapse(ctx context.Context, scope platform.UserScope, synapse Synapse) (Synapse, error)
}

// NeighborSharedSemanticCount is one neighbor memory and the number of SEMANTIC
// neurons it shares with the recalled memory ([R5]).
type NeighborSharedSemanticCount struct {
	NeighborID          string
	SharedSemanticCount int
}

// RecallAnchors is ResetRecallAnchors's return: the post-increment recall count and
// the stored base strength, the two inputs to the read-time EffectiveStrength bump.
type RecallAnchors struct {
	RecallCount  int32
	BaseStrength float64
}
