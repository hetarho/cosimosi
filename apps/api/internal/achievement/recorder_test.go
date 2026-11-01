package achievement

import (
	"context"
	"github.com/cosimosi/api/internal/platform"
	"testing"
)

// This collaborator cannot read profiles, claim rewards, enqueue jobs or open a transaction.
type progressOnlyStore struct{ touches, writes, marks int }

func (s *progressOnlyStore) TouchCounter(context.Context, platform.UserScope, CounterKey) (bool, error) {
	s.touches++
	return false, nil
}
func (s *progressOnlyStore) AddCounter(_ context.Context, _ platform.UserScope, _ CounterKey, delta int64) (int64, error) {
	s.writes++
	return delta, nil
}
func (*progressOnlyStore) RaiseCounter(context.Context, platform.UserScope, CounterKey, int64) (int64, error) {
	panic("diary reports accumulate")
}
func (s *progressOnlyStore) MarkAchieved(context.Context, platform.UserScope, string) (bool, error) {
	s.marks++
	return true, nil
}

func TestRecorderNeedsOnlyCounterWrites(t *testing.T) {
	scope, err := platform.NewUserScope("owner")
	if err != nil {
		t.Fatal(err)
	}
	store := &progressOnlyStore{}
	if err := NewRecorder().RecordProgress(context.Background(), scope, store, CounterDiaryWritten, 1); err != nil {
		t.Fatal(err)
	}
	if store.touches != 1 || store.writes != 1 || store.marks == 0 {
		t.Fatalf("first diary progress: %+v", store)
	}
}
