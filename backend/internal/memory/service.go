package memory

import (
	"context"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

// Dormancy threshold (spec 12): a star is "dormant" once its RAW activation
// exp(-λ·Δt) falls to/below this. These constants MIRROR (must stay in sync with) the
// client forgetting model in entities/memory/model/activation.ts — A_MIN, HALF_LIFE_DAYS,
// and isDormant's default 2·A_MIN. There's no shared cross-language source, so changing
// one side requires changing the other. The server converts the threshold to an
// equivalent time cutoff so the SQL compares last_recalled_at only (no decay math).
const (
	halfLifeDays      = 30.0
	dormancyThreshold = 2 * 0.05 // 2·A_MIN
)

// dormantCutoff converts the dormancy threshold (RAW activation) into a time cutoff:
// activation = exp(-λ·Δt_days) ≤ threshold  ⟺  Δt ≥ ln(1/threshold)/λ
// = HALF_LIFE_DAYS·log2(1/threshold) days. A star last recalled before this is dormant.
// Pure (now injected) so the conversion is testable; no decay math leaks into SQL.
func dormantCutoff(now time.Time) time.Time {
	days := halfLifeDays * math.Log2(1/dormancyThreshold)
	return now.Add(-time.Duration(days * float64(24*time.Hour)))
}

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

// RecordMemory applies server policy — input validation first (records are
// append-only, so this is the only defense: an empty/oversized body would
// otherwise become a permanent record plus paid extraction/embedding jobs),
// then the entry_date default — and delegates the record→extract-job
// transaction to the repository (spec 21: the fragment stars are created
// asynchronously, so memoryIDs is normally empty). Ids are server-generated in
// the repository (§3/§8).
func (s *Service) RecordMemory(ctx context.Context, in RecordInput) (string, []string, error) {
	if strings.TrimSpace(in.Body) == "" {
		return "", nil, ErrEmptyBody
	}
	if utf8.RuneCountInString(in.Body) > MaxBodyRunes {
		return "", nil, ErrBodyTooLong
	}
	// NaN compares false to both bounds — reject it explicitly (binary protobuf
	// can carry NaN doubles even though JSON cannot).
	if math.IsNaN(in.Intensity) || in.Intensity < 0 || in.Intensity > 1 {
		return "", nil, ErrIntensityRange
	}
	if math.IsNaN(in.Valence) || in.Valence < -1 || in.Valence > 1 {
		return "", nil, ErrValenceRange
	}
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

// ReinforceLinks applies co-recall reinforcement increments — delegates to
// the link service, which normalizes/sums and persists idempotently by batch_id.
func (s *Service) ReinforceLinks(ctx context.Context, userID, batchID string, deltas []LinkDelta) error {
	return s.links.ReinforceLinks(ctx, userID, batchID, deltas)
}

// ListDormant returns the caller's long-unrecalled stars (search aid for the dormant
// page). It converts the dormancy threshold to a time cutoff and lets the
// query compare last_recalled_at only — GetUniverse still returns the whole graph
// (constitution §2; ListDormant is not a delete/filter).
func (s *Service) ListDormant(ctx context.Context, userID string) ([]Memory, error) {
	return s.repo.ListDormant(ctx, userID, dormantCutoff(time.Now().UTC()))
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
