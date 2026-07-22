package memory

import (
	"context"
	"errors"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

// ViewSemantic use-case ([R8]) — the read-only viewing of a gist's pregenerated
// compressed text (요지 열람). It is the semantic half of the recall/view asymmetry:
// recall acts on the episodic memory and writes anchors; a view returns a stored,
// already-abstracted string and writes NOTHING — no current_text/seed, no
// recall_count/brightness, no gist timer, no provenance, no clock advance, no LLM
// ([I2][I8][I10], [C7]). The only side effect is the Twinkle spend, and that belongs
// to the SpendGate, not this unit (§CC2).

var (
	// ErrViewSemanticInputRequired rejects an empty memory id or a stage outside the
	// gist ladder's lower bound — stage 0 is the concrete episodic memory ([C6a]),
	// never a viewable gist.
	ErrViewSemanticInputRequired = errors.New("view semantic requires a target id and a gist stage")
	// ErrViewSemanticMemoryNotFound is returned when the target is not the caller's,
	// does not exist, or is soft-deleted — a fully-deleted memory is invisible to the
	// universe, so its gist is not viewable either (§4).
	ErrViewSemanticMemoryNotFound = errors.New("view semantic target memory not found")
	// ErrViewSemanticStageNotRisen is the canonical refusal for a stage the memory has
	// not reached ([C6][V9], §2.9#8): semantic_stages not yet pregenerated, or the
	// requested stage above the risen semantic_stage / the derived ladder. The unit
	// never fabricates a text for an unreached stage.
	ErrViewSemanticStageNotRisen = errors.New("view semantic stage has not risen")
)

// MemoryGist is the gist read surface of one episodic memory: how far it has risen
// ([C6]) and the pregenerated stage texts (nil until the semanticize job has run).
type MemoryGist struct {
	SemanticStage  int16
	SemanticStages *SemanticStages
}

// GistReader is the view use-case's consumer-owned read port (§2.4). The recall
// surface reads the same columns but only inside the recall transaction. The concrete is
// memory/pg (bound to the pool for the quote's standalone signal read, and to the view
// transaction for the paid read).
type GistReader interface {
	// EpisodicMemoryGist loads the gist columns per-user scoped; another user's or a
	// soft-deleted memory returns ErrViewSemanticMemoryNotFound.
	EpisodicMemoryGist(ctx context.Context, scope platform.UserScope, memoryID string) (MemoryGist, error)
}

// ViewSemanticRepo runs the gist-view transaction: the target read, the receipt lookup, the
// Twinkle spend, and the receipt insert commit together (A3), so a paid view is idempotent and
// atomic — while the surface (ViewSemanticTx) exposes no clock/LLM/reconsolidation/provenance/
// representation write, keeping the view structurally read-only ([R8][I2][I10]).
type ViewSemanticRepo interface {
	InViewSemanticTx(ctx context.Context, fn func(tx ViewSemanticTx) error) error
}

// ViewSemanticTx is the narrow transaction surface the paid gist view consumes: the per-user
// graph lock (so concurrent duplicates of one operation serialize), the gist read, and the
// paid-action receipt store. It deliberately exposes NO write beyond the receipt — no anchors, no
// clock, no provenance — so a view cannot express a rewrite. The concrete (memory/pg) also carries
// the DB() handle the economy seam binds the Twinkle spend onto, so the debit joins this tx.
type ViewSemanticTx interface {
	GraphMutationLocker
	GistReader
	PaidActionReceiptStore
}

// GistViewSpendIntent is the gist-view action's intent — kind view_gist, the target
// memory, the client operation id, and the gist-depth signal (the viewed stage itself, a
// monotone "how abstracted" measure). It carries no price: the cost curve that maps a deeper
// signal to a cheaper view lives in the gate, never here ([R8][G4], §CC2/CC3).
func GistViewSpendIntent(operationID string, memoryID string, stage int) SpendIntent {
	return SpendIntent{Kind: SpendKindViewGist, MemoryID: memoryID, OperationID: operationID, Stage: int16(stage)}
}

// ViewSemanticResult is the viewer's return: the pregenerated stage text plus the
// meta the UI labels it with ("stage k of the reached depth", [C6][V9]).
type ViewSemanticResult struct {
	Text         string
	Stage        int16
	ReachedStage int16
}

// ViewSemantic returns the pregenerated semantic_stages text for one gist stage,
// read-only ([R8]): load (per-user scoped) → validate the stage server-authoritatively
// (§2.9#8) → spend through the SpendGate — a precondition of the read, so a denial
// returns no text ([G1]) → return the stored text. Stages are the 1-based gist ladder
// ([C6a]; stage 0 = concrete, not a gist), so stage k's text is SemanticStages[k-1];
// the valid upper bound is the DERIVED stage-array length, never a declared count.
// The load precedes the spend so a not-found or unrisen stage never charges.
func (s *Service) ViewSemantic(ctx context.Context, scope platform.UserScope, operationID string, memoryID string, stage int) (ViewSemanticResult, error) {
	if scope.UserID() == "" {
		return ViewSemanticResult{}, ErrScopeRequired
	}
	if strings.TrimSpace(operationID) == "" {
		return ViewSemanticResult{}, ErrOperationIDRequired
	}
	if memoryID == "" || stage < 1 {
		return ViewSemanticResult{}, ErrViewSemanticInputRequired
	}
	fingerprint := viewSemanticFingerprint(memoryID, stage)

	var result ViewSemanticResult
	err := s.viewSemantics.InViewSemanticTx(ctx, func(tx ViewSemanticTx) error {
		// Lock + receipt replay before any work: a response-loss retry replays the committed
		// gist text without a second debit, and concurrent duplicates serialize (A2/A3).
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		receipt, found, err := tx.GetPaidActionReceipt(ctx, scope, operationID)
		if err != nil {
			return err
		}
		response, replay, err := replayReceipt(receipt, found, PaidActionViewSemantic, fingerprint)
		if err != nil {
			return err
		}
		if replay {
			return decodeReceiptResponse(response, &result)
		}
		gist, err := tx.EpisodicMemoryGist(ctx, scope, memoryID)
		if err != nil {
			return err
		}
		// The reached stage is server-authoritative ([C6], §2.9#8): nil stages = the
		// semanticize job has not run; a stage above the risen semantic_stage or the derived
		// ladder length has not risen. One canonical refusal, no fabrication — the load
		// precedes the spend so an unrisen stage never charges.
		if gist.SemanticStages == nil || stage > len(gist.SemanticStages) || stage > int(gist.SemanticStage) {
			return ErrViewSemanticStageNotRisen
		}
		// The spend joins this transaction (tx is the EconomyTx the composition-root seam binds
		// the Twinkle ledger onto), so the debit + the receipt commit together — a view's only
		// write is the debit and its receipt.
		if err := s.spendGate.CheckAndSpend(ctx, scope, tx, GistViewSpendIntent(operationID, memoryID, stage)); err != nil {
			return err
		}
		result = ViewSemanticResult{
			Text:         gist.SemanticStages[stage-1],
			Stage:        int16(stage),
			ReachedStage: gist.SemanticStage,
		}
		return s.writeReceipt(ctx, scope, tx, PaidActionReceipt{
			OperationID:        operationID,
			Kind:               PaidActionViewSemantic,
			RequestFingerprint: fingerprint,
			EpisodicMemoryID:   stringPtr(memoryID),
		}, result)
	})
	if err != nil {
		return ViewSemanticResult{}, err
	}
	return result, nil
}
