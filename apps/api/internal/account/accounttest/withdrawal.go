// Package accounttest holds account doubles shared by test packages outside account itself.
package accounttest

import (
	"context"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/platform"
)

// errWithdrawalNotExercised refuses a withdrawal reached by a suite that only satisfied the seams.
var errWithdrawalNotExercised = errors.New("accounttest: withdrawal is not exercised by this suite")

// WithInertWithdrawal fills the withdrawal seams and the invite signer a suite does not exercise.
// The account service requires them at construction; these refuse any withdrawal they are asked to
// perform, so a suite that unexpectedly withdraws fails loudly.
func WithInertWithdrawal(deps account.ServiceDeps) account.ServiceDeps {
	if deps.Withdrawals == nil {
		deps.Withdrawals = inertWithdrawalStore{}
	}
	if deps.Scheduler == nil {
		deps.Scheduler = inertScheduler{}
	}
	if deps.Credentials == nil {
		deps.Credentials = inertCredentials{}
	}
	if len(deps.Purgers) == 0 {
		deps.Purgers = []account.UserDataPurger{inertPurger{}}
	}
	if deps.InviteSigner == nil {
		deps.InviteSigner = account.UnavailableInviteSigner{}
	}
	return deps
}

type inertWithdrawalStore struct{}

func (inertWithdrawalStore) InWithdrawalTx(context.Context, func(account.WithdrawalStore) error) error {
	return errWithdrawalNotExercised
}
func (inertWithdrawalStore) WithdrawalStatus(context.Context, platform.UserScope) (time.Time, bool, error) {
	return time.Time{}, false, nil
}
func (inertWithdrawalStore) WithdrawalStatusForUpdate(context.Context, platform.UserScope) (time.Time, bool, error) {
	return time.Time{}, false, nil
}
func (inertWithdrawalStore) MarkWithdrawn(context.Context, platform.UserScope, time.Time) (time.Time, bool, error) {
	return time.Time{}, false, errWithdrawalNotExercised
}
func (inertWithdrawalStore) ClearWithdrawal(context.Context, platform.UserScope, time.Time) (bool, error) {
	return false, errWithdrawalNotExercised
}
func (inertWithdrawalStore) PurgeAccountDependents(context.Context, platform.UserScope) error {
	return errWithdrawalNotExercised
}
func (inertWithdrawalStore) PurgeAccountUser(context.Context, platform.UserScope) (bool, error) {
	return false, errWithdrawalNotExercised
}

type inertScheduler struct{}

func (inertScheduler) Schedule(context.Context, platform.UserScope, time.Time) error {
	return errWithdrawalNotExercised
}
func (inertScheduler) Cancel(context.Context, platform.UserScope) error {
	return errWithdrawalNotExercised
}

type inertCredentials struct{}

func (inertCredentials) SetUserBanned(context.Context, string, bool) error {
	return errWithdrawalNotExercised
}
func (inertCredentials) DeleteUser(context.Context, string) error { return errWithdrawalNotExercised }

type inertPurger struct{}

func (inertPurger) PurgeName() string { return "accounttest" }
func (inertPurger) PurgeUser(context.Context, platform.UserScope) error {
	return errWithdrawalNotExercised
}
