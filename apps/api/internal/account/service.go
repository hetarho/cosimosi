package account

import (
	"time"

	"github.com/cosimosi/api/internal/platform"
)

type Service struct {
	store              Store
	directory          Directory
	inviteSigner       InviteSigner
	inviteGranter      InviteRewardGranter
	signupBonusGranter SignupBonusGranter
	withdrawals        WithdrawalStore
	purgers            []UserDataPurger
	scheduler          WithdrawalSweepScheduler
	credentials        CredentialDirectory
	withdrawalStatuses withdrawalStatusCache
	now                func() time.Time
	newID              func() string
}

type ServiceDeps struct {
	Store              Store
	Directory          Directory
	InviteSigner       InviteSigner
	InviteGranter      InviteRewardGranter
	SignupBonusGranter SignupBonusGranter
	Withdrawals        WithdrawalStore
	Purgers            []UserDataPurger
	Scheduler          WithdrawalSweepScheduler
	Credentials        CredentialDirectory
	Now                func() time.Time
	NewID              func() string
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Store == nil {
		return nil, ErrStoreRequired
	}
	if deps.Directory == nil {
		return nil, ErrDirectoryRequired
	}
	if deps.InviteGranter == nil {
		return nil, ErrInviteGranterRequired
	}
	if deps.SignupBonusGranter == nil {
		return nil, ErrSignupBonusGranterRequired
	}
	withdrawalConfigured := deps.Withdrawals != nil || deps.Scheduler != nil ||
		deps.Credentials != nil || len(deps.Purgers) > 0
	purgers := append([]UserDataPurger(nil), deps.Purgers...)
	if withdrawalConfigured {
		if deps.Withdrawals == nil {
			return nil, ErrWithdrawalStoreRequired
		}
		if deps.Scheduler == nil {
			return nil, ErrWithdrawalSchedulerRequired
		}
		if deps.Credentials == nil {
			return nil, ErrCredentialDirectoryRequired
		}
		if len(purgers) == 0 {
			return nil, ErrPurgersRequired
		}
		purgerNames := make(map[string]struct{}, len(purgers))
		for _, purger := range purgers {
			if purger == nil || purger.PurgeName() == "" {
				return nil, ErrPurgerNameRequired
			}
			if _, exists := purgerNames[purger.PurgeName()]; exists {
				return nil, ErrDuplicatePurger
			}
			purgerNames[purger.PurgeName()] = struct{}{}
		}
	}
	if deps.InviteSigner == nil {
		deps.InviteSigner = UnavailableInviteSigner{}
	}
	if deps.Now == nil {
		deps.Now = func() time.Time { return time.Now().UTC() }
	}
	if deps.NewID == nil {
		deps.NewID = platform.NewID
	}
	return &Service{
		store:              deps.Store,
		directory:          deps.Directory,
		inviteSigner:       deps.InviteSigner,
		inviteGranter:      deps.InviteGranter,
		signupBonusGranter: deps.SignupBonusGranter,
		withdrawals:        deps.Withdrawals,
		purgers:            purgers,
		scheduler:          deps.Scheduler,
		credentials:        deps.Credentials,
		now:                deps.Now,
		newID:              deps.NewID,
	}, nil
}
