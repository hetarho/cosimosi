package memory

import (
	"context"
	"time"
)

// Service holds the diary/star business policy. It depends only on ports
// (Repository, LinkReader) — no transport, no db. There is intentionally no
// Update/Delete method for records (constitution §1: the original is immutable).
type Service struct {
	repo  Repository
	links LinkReader
}

// NewService wires the memory service over its persistence Repository and a
// LinkReader (the synapse read view, satisfied by link.Service).
func NewService(repo Repository, links LinkReader) *Service {
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
