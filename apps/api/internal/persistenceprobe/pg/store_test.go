package pg

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/persistenceprobe"
	"github.com/cosimosi/api/internal/platform"
)

func TestStoreImplementsConsumerOwnedPort(t *testing.T) {
	t.Parallel()

	var _ persistenceprobe.Store = NewStore(&fakePinger{})
}

func TestStoreRequiresUserScope(t *testing.T) {
	t.Parallel()

	store := NewStore(&fakePinger{})
	if err := store.Check(context.Background(), platform.UserScope{}); err == nil {
		t.Fatal("Check unexpectedly succeeded without user scope")
	}
}

func TestStorePingsDatabase(t *testing.T) {
	t.Parallel()

	pinger := &fakePinger{}
	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	if err := NewStore(pinger).Check(context.Background(), scope); err != nil {
		t.Fatalf("Check failed: %v", err)
	}
	if !pinger.called {
		t.Fatal("database pinger was not called")
	}
}

type fakePinger struct {
	called bool
	ok     int32
	err    error
}

func (p *fakePinger) PingDatabase(context.Context) (int32, error) {
	p.called = true
	if p.ok == 0 {
		p.ok = 1
	}
	return p.ok, p.err
}

func TestStoreReturnsPingError(t *testing.T) {
	t.Parallel()

	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	want := errors.New("database unavailable")
	if err := NewStore(&fakePinger{err: want}).Check(context.Background(), scope); !errors.Is(err, want) {
		t.Fatalf("Check error = %v, want %v", err, want)
	}
}

func TestStoreRejectsUnexpectedPingResult(t *testing.T) {
	t.Parallel()

	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := NewStore(&fakePinger{ok: 2}).Check(context.Background(), scope); err == nil {
		t.Fatal("Check unexpectedly succeeded with an unexpected ping result")
	}
}
