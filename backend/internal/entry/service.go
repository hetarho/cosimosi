package entry

import (
	"context"
	"time"
)

// Service holds the business rules for the entry feature.
// HTTP handlers call into Service; Service calls into Repository.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, e Entry) (Entry, error) {
	return s.repo.Create(ctx, e)
}

func (s *Service) GetByDate(ctx context.Context, date time.Time) (Entry, error) {
	return s.repo.GetByDate(ctx, date)
}

func (s *Service) List(ctx context.Context, limit, offset int) ([]Entry, error) {
	return s.repo.List(ctx, limit, offset)
}

func (s *Service) Update(ctx context.Context, e Entry) (Entry, error) {
	return s.repo.Update(ctx, e)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
