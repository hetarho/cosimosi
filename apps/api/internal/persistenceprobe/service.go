package persistenceprobe

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/platform"
)

var ErrStoreRequired = errors.New("persistence probe requires a store")

type Store interface {
	Check(context.Context, platform.UserScope) error
}

type Service struct {
	store Store
}

func NewService(store Store) Service {
	return Service{store: store}
}

func (s Service) Check(ctx context.Context, scope platform.UserScope) error {
	if s.store == nil {
		return ErrStoreRequired
	}
	return s.store.Check(ctx, scope)
}
