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
	now                func() time.Time
	newID              func() string
	paletteIDs         map[string]struct{}
}

type ServiceDeps struct {
	Store              Store
	Directory          Directory
	InviteSigner       InviteSigner
	InviteGranter      InviteRewardGranter
	SignupBonusGranter SignupBonusGranter
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
	if deps.InviteSigner == nil {
		deps.InviteSigner = UnavailableInviteSigner{}
	}
	if deps.Now == nil {
		deps.Now = func() time.Time { return time.Now().UTC() }
	}
	if deps.NewID == nil {
		deps.NewID = platform.NewID
	}
	allowed := make(map[string]struct{}, len(registryPaletteIDs))
	for _, id := range registryPaletteIDs {
		allowed[id] = struct{}{}
	}
	return &Service{
		store:              deps.Store,
		directory:          deps.Directory,
		inviteSigner:       deps.InviteSigner,
		inviteGranter:      deps.InviteGranter,
		signupBonusGranter: deps.SignupBonusGranter,
		now:                deps.Now,
		newID:              deps.NewID,
		paletteIDs:         allowed,
	}, nil
}
