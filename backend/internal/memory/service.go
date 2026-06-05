package memory

import (
	"context"
	"time"
)

// Service holds the diary/star business policy. It depends only on ports
// (Repository, LinkService) — no transport, no db. There is intentionally no
// Update/Delete method for records (constitution §1: the original is immutable).
type Service struct {
	repo  Repository
	links LinkService
}

// NewService wires the memory service over its persistence Repository and a
// LinkService (synapse read + reinforce, satisfied by link.Service).
func NewService(repo Repository, links LinkService) *Service {
	return &Service{repo: repo, links: links}
}

// RecordMemory applies server policy (default entry_date = today UTC) and
// delegates the record→memory→job transaction to the repository. Ids are
// server-generated in the repository; clients never supply them (§3/§8).
func (s *Service) RecordMemory(ctx context.Context, in RecordInput) (string, error) {
	if in.EntryDate.IsZero() {
		in.EntryDate = time.Now().UTC()
	}
	return s.repo.RecordMemory(ctx, in)
}

// GetUniverse composes the full authoritative graph for one user: every star and
// every synapse, dormant ones included. Brightness/coordinates are not computed
// here (client renders them — constitution §2·§3).
func (s *Service) GetUniverse(ctx context.Context, userID string) (Universe, error) {
	memories, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return Universe{}, err
	}
	synapses, err := s.links.ListByUser(ctx, userID)
	if err != nil {
		return Universe{}, err
	}
	return Universe{Memories: memories, Synapses: synapses}, nil
}

// ReinforceLinks applies co-recall reinforcement increments (spec 11) — delegates to
// the link service, which normalizes/sums and persists idempotently by batch_id.
func (s *Service) ReinforceLinks(ctx context.Context, userID, batchID string, deltas []LinkDelta) error {
	return s.links.ReinforceLinks(ctx, userID, batchID, deltas)
}

// RecallMemory re-ignites a star (last_recalled_at=now) and returns its immutable
// original Record (records JOIN). Touch is WHERE-guarded, so an absent memory leaves
// nothing changed and GetRecord surfaces ErrNotFound (→ NotFound at the handler).
func (s *Service) RecallMemory(ctx context.Context, userID, memoryID string) (Record, error) {
	if err := s.repo.TouchRecall(ctx, userID, memoryID); err != nil {
		return Record{}, err
	}
	return s.repo.GetRecord(ctx, userID, memoryID)
}
