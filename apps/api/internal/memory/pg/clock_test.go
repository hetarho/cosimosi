package pg

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

func TestUniverseClockRequiresUserScope(t *testing.T) {
	t.Parallel()

	if _, err := (Store{}).UniverseClock(context.Background(), platform.UserScope{}); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("UniverseClock error = %v, want ErrUserScopeRequired", err)
	}
	if _, err := (Store{}).AdvanceUniverseClock(context.Background(), platform.UserScope{}, time.Now()); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("AdvanceUniverseClock error = %v, want ErrUserScopeRequired", err)
	}
}

func TestAdvanceUniverseClockRejectsZeroTarget(t *testing.T) {
	t.Parallel()

	// NewStore(nil) passes the readiness check without a database, so the zero-target
	// rejection is reached before any query would run.
	_, err := NewStore(nil).AdvanceUniverseClock(context.Background(), mustScope(t), time.Time{})
	if !errors.Is(err, ErrClockTargetRequired) {
		t.Fatalf("AdvanceUniverseClock error = %v, want ErrClockTargetRequired", err)
	}
}
