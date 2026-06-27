package pg

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/persistenceprobe"
	"github.com/cosimosi/api/internal/platform"
)

type Pinger interface {
	PingDatabase(context.Context) (int32, error)
}

type Store struct {
	pinger Pinger
}

var _ persistenceprobe.Store = Store{}

func NewStore(pinger Pinger) Store {
	return Store{pinger: pinger}
}

func (s Store) Check(ctx context.Context, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return errors.New("persistence probe requires authenticated user scope")
	}
	if s.pinger == nil {
		return errors.New("persistence probe requires a database pinger")
	}
	got, err := s.pinger.PingDatabase(ctx)
	if err != nil {
		return err
	}
	if got != 1 {
		return errors.New("persistence probe returned an unexpected database ping result")
	}
	return nil
}
