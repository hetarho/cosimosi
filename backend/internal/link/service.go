package link

import (
	"context"

	"github.com/cosimosi/backend/internal/memory"
)

// Service is the read-only synapse service. It satisfies memory.LinkReader, so
// the memory service can compose a Universe without importing this package.
type Service struct {
	repo Repository
}

// NewService builds the synapse read service over a Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListByUser returns every synapse for the user (dormant included).
func (s *Service) ListByUser(ctx context.Context, userID string) ([]memory.Synapse, error) {
	return s.repo.ListByUser(ctx, userID)
}
