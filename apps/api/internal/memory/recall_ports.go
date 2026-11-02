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

// ErrInsufficientTwinkle is the canonical denial EconomyTx.SpendMemory returns when the caller
// cannot afford the action ([G1]). Recall/RecallDiaryStars surface it verbatim
// so the transport maps one code and the UI shows one message; the no-op gate never
// returns it (it charges nothing), the real economy gate does.
var ErrInsufficientTwinkle = errors.New("insufficient twinkle for this action")

// SpendKind names WHICH metered action a SpendIntent is for. It is a depth/kind
// SIGNAL, never a price: the gate maps a kind (+ its target and depth signal) to a
// cost via the cost curve, so no price literal ever lives in this context.
// recall = 회고하기; view_gist = 요지 열람 (the paired gist-view consumer).
type SpendKind string

const (
	SpendKindRecall   SpendKind = "recall"
	SpendKindViewGist SpendKind = "view_gist"
)

// SpendIntent tells the economy what is being spent on: the action kind, the target
// memory, the client operation id, and the kind's depth signal — a recall carries the
// server-derived accessibility cost weight ([F4], computed at spend time by the recall
// use-case), a gist view carries the viewed stage ([R8][G4]). It carries NO price: this
// context supplies only the signals and the gate prices them and decides whether the balance
// allows the action. Stage is unused (0) for a recall; AccessibilityCost is unused
// (0) for a gist view. OperationID + MemoryID derive the spend's per-action/per-member dedup
// key at the economy seam, so a duplicate spend applies no second balance delta.
type SpendIntent struct {
	Kind              SpendKind
	MemoryID          string
	OperationID       string
	Stage             int16
	AccessibilityCost float64
}

// RecallSpendIntent is the recall action's intent — the target memory plus its
// spend-time accessibility cost weight ([F4]), never a price. operationID carries the
// paid-action identity the economy seam derives the dedup key from; in a whole-diary
// recall every member shares the operation id but differs by memory id, so each member's
// spend dedup key is distinct.
func RecallSpendIntent(operationID string, memoryID string, accessibilityCost float64) SpendIntent {
	return SpendIntent{Kind: SpendKindRecall, MemoryID: memoryID, OperationID: operationID, AccessibilityCost: accessibilityCost}
}

// EconomyTx exposes only the cross-context effects bound to this open transaction; the composition
// root supplies these behaviors and persistence handles never cross inward. Each effect commits or
// rolls back with the transaction that produced it.
//
//   - The spend pair takes only a SpendIntent's kind, target and depth signal, never a price. A
//     denial is ErrInsufficientTwinkle and, joining the caller's transaction, resets nothing.
//   - EarnDiary is the write grant ([G3]): once per launched diary, not per memory, and only after
//     the monotonic launch guard admits the diary ([I10]).
//   - RecordProgress reports a counter key and a delta ([A6][I11]). The payload cannot describe a
//     memory, the return carries no value, the producer reduces measurements to counts before it
//     reports, and an error aborts the causing transaction: the pre-recall decay depth is
//     unrecoverable afterwards, so a counter that silently diverged could never be repaired.
type EconomyTx interface {
	CheckMemorySpend(context.Context, platform.UserScope, SpendIntent) error
	SpendMemory(context.Context, platform.UserScope, SpendIntent) error
	EarnDiary(context.Context, platform.UserScope, string) error
	RecordProgress(context.Context, platform.UserScope, string, int) error
}

// NoEconomy is the economy-less EconomyTx binding for tests and roots without an economy: nothing
// is charged, earned or counted. Production roots bind the real capabilities.
type NoEconomy struct{}

func (NoEconomy) CheckMemorySpend(context.Context, platform.UserScope, SpendIntent) error { return nil }
func (NoEconomy) SpendMemory(context.Context, platform.UserScope, SpendIntent) error      { return nil }
func (NoEconomy) EarnDiary(context.Context, platform.UserScope, string) error             { return nil }
func (NoEconomy) RecordProgress(context.Context, platform.UserScope, string, int) error   { return nil }

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
	EconomyTx
	ProgressionTx
	MemoryProvenanceStore
	ForgettingOffsetStore
	PaidActionReceiptStore
	// EpisodicMemoryForRecall loads the memory being recalled with the state the branch
	// needs: current_text/seed for the compare + reshape, and semantic_stage/
	// semantic_stages for the remaining-stage selection ([C7]). Returns
	// ErrRecallMemoryNotFound when no such row is the caller's.
	EpisodicMemoryForRecall(ctx context.Context, scope platform.UserScope, memoryID string) (EpisodicMemory, error)
	// RecallMemberSynapses returns every synapse whose BOTH endpoints are the recalled
	// memory's member neurons — the co-activated edges Reinforce batch-LTPs ([R3]). Only
	// neuron↔neuron edges exist, so no memory↔memory edge can be returned ([I4][I6]).
	RecallMemberSynapses(ctx context.Context, scope platform.UserScope, memoryID string) ([]Synapse, error)
	// LiveDiaryRecallAnchors returns the still-live (soft-delete-excluded) episodic
	// memories born from a diary — the whole-diary recall set ([D3]) — each with the
	// forgetting/strength anchors its spend pricing derives from, in one batch read.
	LiveDiaryRecallAnchors(ctx context.Context, scope platform.UserScope, diaryID string) ([]DiaryRecallAnchor, error)
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
	ApplyReconsolidatedText(ctx context.Context, scope platform.UserScope, memoryID string, currentText string, seed int64) (int64, error)
	SynapseWriter
}

// SynapseWriter is the single synapse-write method Reinforce's batch LTP uses. It is a
// one-method view of the launch-side SynapseStore's UpsertSynapse so RecallTx pulls in
// only the write it needs, not the launch-time reads. The pg concrete satisfies both.
type SynapseWriter interface {
	UpsertSynapses(ctx context.Context, scope platform.UserScope, synapses []Synapse) error
}

// NeighborSharedSemanticCount is one neighbor memory and the number of SEMANTIC
// neurons it shares with the recalled memory ([R5]).
type NeighborSharedSemanticCount struct {
	NeighborID          string
	SharedSemanticCount int
}

// DiaryRecallAnchor is one live diary memory's forgetting/strength anchors — exactly
// the scalars the spend-time accessibility signal derives from ([F4][G4]), with no
// text or gist payload riding along. The whole-diary recall and its quote read these
// in one batch, so every per-memory price in a batch derives from one pre-action
// snapshot (a reinforce nudging a sibling's offset cannot reprice the batch mid-way).
type DiaryRecallAnchor struct {
	EpisodicMemoryID         string
	Arousal                  float64
	BaseStrength             float64
	RecallCount              int32
	CreatedUniverseTime      time.Time
	LastRecalledUniverseTime *time.Time
	ForgettingOffsetDays     float64
}

// RecallAnchors is ResetRecallAnchors's return: the post-increment recall count and
// the stored base strength, the two inputs to the read-time EffectiveStrength bump.
type RecallAnchors struct {
	RecallCount  int32
	BaseStrength float64
}
