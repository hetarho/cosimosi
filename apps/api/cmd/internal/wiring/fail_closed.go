package wiring

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/platform"
)

// The job worker serves no request: it settles no signup, quotes no spend, charges no purchase and
// takes no claim. Each of those seams is bound to a refusal rather than a no-op, so a path that
// unexpectedly reaches one is loud instead of silently doing nothing.
var (
	ErrInviteSettlementUnavailable  = errors.New("invite settlement is not available in the job worker")
	ErrSignupBonusUnavailable       = errors.New("signup bonus settlement is not available in the job worker")
	ErrProgressRecordingUnavailable = errors.New("account progress recording is not available in the job worker")
	ErrSpendQuotingUnavailable      = errors.New("twinkle spend quoting is not available in the job worker")
	ErrClaimSchedulingUnavailable   = errors.New("achievement claims are not taken in the job worker")
	ErrPurchaseUnavailable          = errors.New("ornament purchases are not charged in the job worker")
)

type noInviteGranter struct{}

func (noInviteGranter) Grant(context.Context, platform.UserScope, string) error {
	return ErrInviteSettlementUnavailable
}

type noSignupBonusGranter struct{}

func (noSignupBonusGranter) Grant(context.Context, platform.UserScope) error {
	return ErrSignupBonusUnavailable
}

type noAccountProgress struct{}

func (noAccountProgress) RecordProgress(context.Context, platform.UserScope, string, int) error {
	return ErrProgressRecordingUnavailable
}

type noSpendSignals struct{}

func (noSpendSignals) RecallAccessibility(context.Context, platform.UserScope, string) (float64, error) {
	return 0, ErrSpendQuotingUnavailable
}

func (noSpendSignals) DiaryRecallAccessibilities(context.Context, platform.UserScope, string) ([]float64, error) {
	return nil, ErrSpendQuotingUnavailable
}

func (noSpendSignals) ViewableGistStage(context.Context, platform.UserScope, string) (int, error) {
	return 0, ErrSpendQuotingUnavailable
}

// noSettlementScheduler refuses to arm a drain: a claim stamped with no drain behind it would
// reinstate the "press again or lose it" recovery the drain replaced.
type noSettlementScheduler struct{}

func (noSettlementScheduler) ScheduleSettlement(context.Context, platform.UserScope, achievement.ClaimTx, string) error {
	return ErrClaimSchedulingUnavailable
}
