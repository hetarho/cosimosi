package memory

import (
	"context"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

// RestoreMemoryTextCommand retrieves a memory's stored narrative rather than reconstructing it.
type RestoreMemoryTextCommand struct {
	OperationID string
	MemoryID    string
	SyncConsent bool
}

// RestoreMemoryText restores access to the unchanged stored text. The debit, recovery and receipt
// share one transaction; no comparison provider or representation rewrite belongs to this action.
func (s *PaidActionService) RestoreMemoryText(ctx context.Context, scope platform.UserScope, cmd RestoreMemoryTextCommand) (RecallResult, error) {
	if scope.UserID() == "" {
		return RecallResult{}, ErrScopeRequired
	}
	if strings.TrimSpace(cmd.OperationID) == "" {
		return RecallResult{}, ErrOperationIDRequired
	}
	if strings.TrimSpace(cmd.MemoryID) == "" {
		return RecallResult{}, ErrRecallInputRequired
	}
	today, err := s.userToday(ctx, scope)
	if err != nil {
		return RecallResult{}, err
	}
	fingerprint := actionFingerprint(string(PaidActionRestoreMemoryText), cmd.MemoryID)
	var result RecallResult
	err = s.recalls.InRecallTx(ctx, func(tx RecallTx) error {
		if err := tx.LockGraphMutation(ctx, scope); err != nil {
			return err
		}
		if replayed, err := replayIfReceipted(ctx, scope, tx, PaidActionRestoreMemoryText, cmd.OperationID, fingerprint, &result); err != nil || replayed {
			return err
		}
		sync, err := s.syncToToday(ctx, scope, tx, today, cmd.SyncConsent)
		if err != nil {
			return err
		}
		memory, err := tx.EpisodicMemoryForRecall(ctx, scope, cmd.MemoryID)
		if err != nil {
			return err
		}
		if memory.DeletedAt != nil {
			return ErrRecallMemoryUnavailable
		}
		anchor := recallAnchorOf(memory)
		if err := tx.SpendMemory(ctx, scope, RecallSpendIntent(cmd.OperationID, cmd.MemoryID, recallAccessibilitySignal(anchor, sync.Current))); err != nil {
			return err
		}
		effects, err := s.reinforce(ctx, scope, tx, cmd.MemoryID, sync.Current)
		if err != nil {
			return err
		}
		// A paid restoration exposes the entire stored text even after accumulated interference.
		if memory.ForgettingOffsetDays != 0 {
			if err := tx.AddForgettingOffset(ctx, scope, []string{cmd.MemoryID}, -memory.ForgettingOffsetDays); err != nil {
				return err
			}
		}
		result = RecallResult{CurrentText: memory.CurrentText, Seed: seedOrZero(memory.Seed), RecallCount: effects.RecallCount, EffectiveStrength: effects.EffectiveStrength, Sync: sync}
		recovered := 0
		if recallRecoversDecay(anchor, sync.Current) {
			recovered = 1
		}
		if err := s.recordRecallProgress(ctx, scope, tx, 1, recovered); err != nil {
			return err
		}
		return s.writeReceipt(ctx, scope, tx, PaidActionReceipt{OperationID: cmd.OperationID, Kind: PaidActionRestoreMemoryText, RequestFingerprint: fingerprint, EpisodicMemoryID: stringPtr(cmd.MemoryID)}, result)
	})
	if err != nil {
		return RecallResult{}, err
	}
	return result, nil
}
