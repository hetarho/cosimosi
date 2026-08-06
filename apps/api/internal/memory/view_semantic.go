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
	// ErrViewSemanticInputRequired rejects an empty memory id. It no longer covers a stage
	// range: the caller names a memory and the server derives the depth, so there is no
	// client-supplied stage left to be out of range.
	ErrViewSemanticInputRequired = errors.New("view semantic requires a target id")
	// ErrViewSemanticMemoryNotFound is returned when the target is not the caller's,
	// does not exist, or is soft-deleted — a fully-deleted memory is invisible to the
	// universe, so its gist is not viewable either (§4).
	ErrViewSemanticMemoryNotFound = errors.New("view semantic target memory not found")
	// ErrViewSemanticStageNotRisen is the canonical refusal for a memory with no gist to
	// read ([C6][V9], §2.9#8): semantic_stages not yet pregenerated, or a semantic_stage of
	// 0 — stage 0 is the concrete episodic memory ([C6a]), never a viewable gist. The unit
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
// memory, the client operation id, and the gist-depth signal (the served stage itself, a
// monotone "how abstracted" measure). The stage is DERIVED from the memory before this is built,
// never taken from a request, so a client cannot name the depth it is priced at. It carries no
// price: the cost curve that maps a deeper signal to a cheaper view lives in the gate, never here
// ([R8][G4], §CC2/CC3).
func GistViewSpendIntent(operationID string, memoryID string, stage int) SpendIntent {
	return SpendIntent{Kind: SpendKindViewGist, MemoryID: memoryID, OperationID: operationID, Stage: int16(stage)}
}

// viewableGistStage is the ONE derivation of "which rung does a view of this memory reach": the
// risen semantic_stage bounded by the pregenerated ladder (the column may lead the texts). Both
// readers call it — the quote that prices the read ahead of time, and the read itself — so a quote
// can never name a different depth than the one charged for. A memory whose gist has not risen is
// not viewable, with the same canonical refusal in both places.
func viewableGistStage(gist MemoryGist) (int, error) {
	if gist.SemanticStages == nil {
		return 0, ErrViewSemanticStageNotRisen
	}
	reached := int(gist.SemanticStage)
	if reached > len(gist.SemanticStages) {
		reached = len(gist.SemanticStages)
	}
	if reached < 1 {
		return 0, ErrViewSemanticStageNotRisen
	}
	return reached, nil
}

// ViewSemanticResult is the viewer's return: the pregenerated stage text plus the
// meta the UI labels it with ("stage k of the reached depth", [C6][V9]).
type ViewSemanticResult struct {
	Text string
	// The stage served, which IS the memory's reached stage now that the server picks it.
	ReachedStage int16
}

// ViewSemantic returns the pregenerated semantic_stages text for the memory's CURRENT gist
// depth, read-only ([R8]): load (per-user scoped) → derive the stage from the memory itself
// (§2.9#8) → spend through the SpendGate — a precondition of the read, so a denial returns no
// text ([G1]) → return the stored text. Stages are the 1-based gist ladder ([C6a]; stage 0 =
// concrete, not a gist), so stage k's text is SemanticStages[k-1]; the depth served is the risen
// semantic_stage clamped to the DERIVED stage-array length, never a declared count and never a
// client's number. The load precedes the spend so a not-found or unrisen memory never charges.
func (s *Service) ViewSemantic(ctx context.Context, scope platform.UserScope, operationID string, memoryID string) (ViewSemanticResult, error) {
	if scope.UserID() == "" {
		return ViewSemanticResult{}, ErrScopeRequired
	}
	if strings.TrimSpace(operationID) == "" {
		return ViewSemanticResult{}, ErrOperationIDRequired
	}
	if memoryID == "" {
		return ViewSemanticResult{}, ErrViewSemanticInputRequired
	}
	// Keyed on the memory alone. The stage is no longer part of the request, and folding the
	// derived one in here would break the replay this fingerprint exists for: a retry after the
	// memory rose would hash differently and conflict instead of returning the committed read.
	fingerprint := viewSemanticFingerprint(memoryID)

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
		// Server-authoritative depth ([C6], §2.9#8) — the SAME derivation the quote priced from,
		// so the read cannot reach a different rung than the one the user was shown a cost for.
		// The load precedes the spend, so an unrisen memory never charges.
		stage, err := viewableGistStage(gist)
		if err != nil {
			return err
		}
		// The spend joins this transaction (tx is the EconomyTx the composition-root seam binds
		// the Twinkle ledger onto), so the debit + the receipt commit together — a view's only
		// write is the debit and its receipt.
		if err := s.spendGate.CheckAndSpend(ctx, scope, tx, GistViewSpendIntent(operationID, memoryID, stage)); err != nil {
			return err
		}
		result = ViewSemanticResult{
			Text:         gist.SemanticStages[stage-1],
			ReachedStage: int16(stage),
		}
		// The 요지화-도달 axis is observed HERE rather than when the worker raises a stage: the
		// value reported is the stage actually served, and the counter's reach mode keeps the
		// high-water mark.
		if err := s.recordViewSemanticProgress(ctx, scope, tx, stage); err != nil {
			return err
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
