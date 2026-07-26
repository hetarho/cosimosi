package account

import (
	"time"
)

type Service struct {
	store        Store
	directory    Directory
	inviteSigner InviteSigner
	now          func() time.Time
	paletteIDs   map[string]struct{}
}

type ServiceDeps struct {
	Store        Store
	Directory    Directory
	InviteSigner InviteSigner
	Now          func() time.Time
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Store == nil {
		return nil, ErrStoreRequired
	}
	if deps.Directory == nil {
		return nil, ErrDirectoryRequired
	}
	if deps.InviteSigner == nil {
		deps.InviteSigner = UnavailableInviteSigner{}
	}
	if deps.Now == nil {
		deps.Now = func() time.Time { return time.Now().UTC() }
	}
	allowed := make(map[string]struct{}, len(registryPaletteIDs))
	for _, id := range registryPaletteIDs {
		allowed[id] = struct{}{}
	}
	return &Service{
		store:        deps.Store,
		directory:    deps.Directory,
		inviteSigner: deps.InviteSigner,
		now:          deps.Now,
		paletteIDs:   allowed,
	}, nil
}
