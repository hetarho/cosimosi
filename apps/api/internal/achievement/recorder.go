package achievement

import (
	"context"
	"github.com/cosimosi/api/internal/platform"
)

// Recorder applies catalog progress inside the producer's supplied transaction.
// It has no payout, repository, scheduler or clock dependency.
type Recorder struct{}

func NewRecorder() *Recorder { return &Recorder{} }

func (s *Service) RecordProgress(ctx context.Context, scope platform.UserScope, store Store, key CounterKey, delta int) error {
	return NewRecorder().RecordProgress(ctx, scope, store, key, delta)
}
