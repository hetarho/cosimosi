package memory

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cosimosi/backend/internal/values"
)

// Dormancy threshold (spec 12): a star is "dormant" once its RAW activation
// exp(-λ·Δt) falls to/below this. These constants MIRROR (must stay in sync with) the
// client forgetting model in entities/memory/model/activation.ts — A_MIN, HALF_LIFE_DAYS,
// and isDormant's default 2·A_MIN. There's no shared cross-language source, so changing
// one side requires changing the other. The server converts the threshold to an
// equivalent time cutoff so the SQL compares last_recalled_at only (no decay math).
const (
	halfLifeDays      = values.DecayHalfLifeDays
	dormancyThreshold = values.DecayDormantFactor * values.DecayAMin // dormant_factor·A_MIN
)

// Reconsolidation reshaping parameters (spec 23). A recall only reshapes a star when
// it carries new context (prediction error ≥ peThreshold); the reshape MAGNITUDE
// shrinks as the star gets more consolidated (strength↑ ⇒ magnitude↓), and the change
// is bounded both per-step (brightness) and cumulatively (hue/form). These are the
// single source for the numbers; policy/domain/star.md mirrors them.
const (
	// peThreshold gates the soft window: below it a recall is a plain re-ignition
	// (spec 11), no reshape, no evolution row (acceptance 1.1).
	peThreshold = values.ReshapePeThreshold
	// baseStep is the magnitude ceiling at pe=1, strength=0 — magnitude =
	// baseStep·pe·(1-strength) (acceptance 1.3).
	baseStep = values.ReshapeBaseStep
	// brightness offset moves one bounded step per reshape: dir·clamp(magnitude, 0.10,
	// 0.22) (acceptance 1.2).
	minBrightStep = values.ReshapeMinBrightStep
	maxBrightStep = values.ReshapeMaxBrightStep
	// brightnessOffsetMax bounds the CUMULATIVE offset so the stored value (and the
	// evolution_history snapshot 24 reads) can't grow without limit across many recalls.
	// Effective brightness = clamp(base+offset, A_MIN, 1) with base∈[A_MIN,1], so ±1
	// already saturates both ends — beyond it the offset would be meaningless.
	brightnessOffsetMax = values.ReshapeBrightnessOffsetMax
	// neighborFactor scales the step applied to direct neighbors — smaller than the
	// recalled star's (acceptance 1.5).
	neighborFactor = values.ReshapeNeighborFactor
	// hue jitter is magnitude·hueGainDeg degrees per step, accumulated within ±28°
	// of the emotion-anchored color (acceptance 1.2).
	hueGainDeg = values.ReshapeHueGainDeg
	hueMaxDeg  = values.ReshapeHueMaxDeg
	// form-seed jitter is magnitude·formGain per step, accumulated within ±formDeltaMax.
	formGain     = values.ReshapeFormGain
	formDeltaMax = values.ReshapeFormDeltaMax
	// strength = clamp(strengthRecallGain·log2(1+co_recall) + ageGain·age_norm, 0, 1):
	// stars recalled more often / older read as more consolidated and reshape less.
	strengthRecallGain = values.ReshapeStrengthRecallGain
	ageGain            = values.ReshapeAgeGain
	ageRefDays         = values.ReshapeAgeRefDays
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
// (Repository, LinkService, Extractor) — no transport, no db, no ai. There is
// intentionally no Update/Delete method for records (constitution §1: the
// original is immutable).
type Service struct {
	repo      Repository
	links     LinkService
	extractor Extractor
}

// NewService wires the memory service over its persistence Repository, a
// LinkService (synapse read + reinforce, satisfied by link.Service) and the
// segmentation Extractor (SegmentMemory preview; composition-root adapter over
// ai.Extractor). A nil extractor degrades to one whole-body neutral segment —
// same keyless behavior as ai.NoopExtractor, without importing ai.
func NewService(repo Repository, links LinkService, extractor Extractor) *Service {
	return &Service{repo: repo, links: links, extractor: extractor}
}

// SegmentMemory runs the LLM extraction SYNCHRONOUSLY and returns the proposed
// fragments WITHOUT persisting anything — the preview the user reviews/edits
// before RecordMemory commits the confirmed list. Body bounds mirror the write
// path (the preview must never accept a diary the record would reject). An
// extraction failure surfaces as an error (the user retries; nothing was
// written); a degraded/keyless extractor yields one whole-body segment, never
// zero.
func (s *Service) SegmentMemory(ctx context.Context, body string) ([]SegmentInput, error) {
	if strings.TrimSpace(body) == "" {
		return nil, ErrEmptyBody
	}
	if utf8.RuneCountInString(body) > MaxBodyRunes {
		return nil, ErrBodyTooLong
	}
	if s.extractor == nil {
		return []SegmentInput{{Text: strings.TrimSpace(body), Mood: MoodNeutral}}, nil
	}
	segs, err := s.extractor.Extract(ctx, body)
	if err != nil {
		return nil, fmt.Errorf("segment extract: %w", err)
	}
	return segs, nil
}

// RecordMemory applies server policy — input validation first (records are
// append-only, so this is the only defense: an empty/oversized body would
// otherwise become a permanent record plus paid extraction/embedding jobs),
// then the entry_date default — and delegates the transaction to the
// repository. With user-confirmed Segments (review step) the fragments are
// persisted in the same transaction and memoryIDs returns them; without, the
// legacy async-extract path runs and memoryIDs is empty (spec 21). Ids are
// server-generated in the repository (§3/§8).
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
	// User-confirmed fragments (review step): same up-front defense as the body —
	// each becomes a permanent memory row plus a paid embed job, so an empty/
	// oversized/out-of-range fragment is rejected before the transaction.
	if len(in.Segments) > MaxSegments {
		return "", nil, ErrTooManySegments
	}
	for i := range in.Segments {
		seg := &in.Segments[i]
		seg.Text = strings.TrimSpace(seg.Text)
		if seg.Text == "" {
			return "", nil, ErrEmptySegment
		}
		if utf8.RuneCountInString(seg.Text) > MaxBodyRunes {
			return "", nil, ErrSegmentTooLong
		}
		if math.IsNaN(seg.Intensity) || seg.Intensity < 0 || seg.Intensity > 1 {
			return "", nil, ErrIntensityRange
		}
		if math.IsNaN(seg.Valence) || seg.Valence < -1 || seg.Valence > 1 {
			return "", nil, ErrValenceRange
		}
	}
	if in.EntryDate.IsZero() {
		in.EntryDate = time.Now().UTC()
	}
	return s.repo.RecordMemory(ctx, in)
}

// GetUniverse composes the full authoritative graph for one user: every star and
// every synapse, dormant ones included. Brightness/coordinates are not computed here
// (client renders them — constitution §2·§3). spec 07: the server no longer folds a
// "요즘" ambient summary — the client derives the emotion ranking + arousal from the
// loaded stars (+recall_count) via the Bjork retrieval-strength R itself.
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

// ListRecords returns the caller's original diaries as wayfinding entry points
// (spec 28, 원본 일기로 별 찾기). Thin passthrough — the repository owns the GROUP BY /
// excerpt / ordering; records stays read-only (constitution §1).
func (s *Service) ListRecords(ctx context.Context, userID string) ([]RecordSummary, error) {
	return s.repo.ListRecords(ctx, userID)
}

// GetRecordByID reads one immutable original diary by its record_id (spec 28, change 09 —
// the standalone read-only diary page). Side-effect free: unlike RecallMemory it performs
// NO TouchRecall — reading a diary in the journal must not re-ignite its stars. Owner
// isolation + NotFound mapping live in the repository (records stays read-only, 헌법1).
func (s *Service) GetRecordByID(ctx context.Context, userID, recordID string) (Record, error) {
	return s.repo.GetRecordByID(ctx, userID, recordID)
}

// ReinforceLinks applies co-recall reinforcement increments — delegates to
// the link service, which normalizes/sums and persists idempotently by batch_id.
func (s *Service) ReinforceLinks(ctx context.Context, userID, batchID string, deltas []LinkDelta) error {
	return s.links.ReinforceLinks(ctx, userID, batchID, deltas)
}

// --- reconsolidation pure helpers (spec 23, unit-tested) ---

// cosineSim is the cosine similarity of two equal-length vectors, 0 when either is
// empty, lengths differ, or a vector is all-zero (no defined angle). Used for the PE
// gate; a pure function so the soft-window math is testable without a DB.
func cosineSim(a, b []float64) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

// strengthOf is the strength-dependent term (acceptance 1.3): a star recalled more
// often (co_recall) or older (age) reads as more consolidated and reshapes less.
// strength = clamp(strengthRecallGain·log2(1+co_recall) + ageGain·clamp(age/ageRef,0,1), 0, 1).
func strengthOf(coRecall int, ageDays float64) float64 {
	if coRecall < 0 {
		coRecall = 0
	}
	rec := strengthRecallGain * math.Log2(1+float64(coRecall))
	age := ageGain * clampf(ageDays/ageRefDays, 0, 1)
	return clampf(rec+age, 0, 1)
}

// reshapeStep is the raw reshape magnitude = baseStep·pe·(1-strength) (acceptance 1.3):
// strength↑ ⇒ magnitude↓. Bounds on the APPLIED change live in reshapeState.
func reshapeStep(pe, strength float64) float64 {
	return baseStep * pe * (1 - strength)
}

// directionFor picks a deterministic ±1 from the star id + version (acceptance 1.2:
// "방향은 회상 별의 시드+version에서 결정론적으로" — the id hash stands in for the
// client-derived seed, which the server never holds). Same (id, version) → same dir.
func directionFor(memoryID string, version int) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(memoryID))
	if (h.Sum32()+uint32(version))%2 == 0 {
		return 1
	}
	return -1
}

// reshapeState applies one bounded reconsolidation step to a star's cumulative state
// (acceptance 1.2): brightness offset moves dir·clamp(magnitude,0.10,0.22)·factor; hue
// and form-seed jitter accumulate within ±28°/±formDeltaMax; version++. factor scales
// the whole step down for direct neighbors (acceptance 1.5). Pure — no I/O.
func reshapeState(prev ReshapeState, magnitude float64, dir int, factor float64) ReshapeState {
	d := float64(dir)
	brightStep := clampf(magnitude, minBrightStep, maxBrightStep) * factor
	hueStep := d * magnitude * hueGainDeg * factor
	formStep := d * magnitude * formGain * factor
	return ReshapeState{
		BrightnessOffset: clampf(prev.BrightnessOffset+d*brightStep, -brightnessOffsetMax, brightnessOffsetMax),
		HueShift:         clampf(prev.HueShift+hueStep, -hueMaxDeg, hueMaxDeg),
		FormSeedDelta:    clampf(prev.FormSeedDelta+formStep, -formDeltaMax, formDeltaMax),
		Version:          prev.Version + 1,
	}
}

// peGate is the prediction-error gate input: clamp(1 - cos(recall, consolidated), 0, 1),
// but 0 when either embedding can't define an angle (empty or zero-norm). cosineSim
// returns 0 for a degenerate vector, which would otherwise read as pe=1 (maximal
// novelty) and reshape on every recall — "can't measure novelty" must mean pe 0.
func peGate(recall, consolidated []float64) float64 {
	if !usableEmbedding(recall) || !usableEmbedding(consolidated) {
		return 0
	}
	return clampf(1-cosineSim(recall, consolidated), 0, 1)
}

// usableEmbedding reports whether a vector can define a cosine angle (non-empty with at
// least one non-zero component).
func usableEmbedding(v []float64) bool {
	for _, x := range v {
		if x != 0 {
			return true
		}
	}
	return false
}

// clampf bounds v to [lo, hi].
func clampf(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// ListDormant returns the caller's long-unrecalled stars (search aid for the dormant
// page). It converts the dormancy threshold to a time cutoff and lets the
// query compare last_recalled_at only — GetUniverse still returns the whole graph
// (constitution §2; ListDormant is not a delete/filter).
func (s *Service) ListDormant(ctx context.Context, userID string) ([]Memory, error) {
	return s.repo.ListDormant(ctx, userID, dormantCutoff(time.Now().UTC()))
}

// RecallMemory re-ignites a star (last_recalled_at=now), applies PE-gated
// reconsolidation reshaping (spec 23), and returns its immutable original Record
// (records JOIN). Touch is WHERE-guarded, so an absent memory leaves nothing changed
// and GetRecord surfaces ErrNotFound (→ NotFound at the handler). The original record
// is never mutated — only the star layer + the append-only variant log (constitution
// §1·§2).
func (s *Service) RecallMemory(ctx context.Context, userID, memoryID string) (Record, error) {
	if err := s.repo.TouchRecall(ctx, userID, memoryID); err != nil {
		return Record{}, err
	}
	// Reconsolidation is BEST-EFFORT: it must never deny the user their immutable
	// original (the spec-11 recall contract). A reshape failure (DB hiccup on a
	// reshape write/read) degrades this recall to plain re-ignition — the record read
	// below is the authority on existence and is what the caller actually requested.
	_ = s.reconsolidate(ctx, userID, memoryID)
	return s.repo.GetRecord(ctx, userID, memoryID)
}

// reconsolidate runs the spec-23 soft-window model: read the star's PE/strength
// context, gate on prediction error, and — when novel enough — reshape the recalled
// star plus its DIRECT neighbors (content-limited; indirect neighbors stay frozen,
// acceptance 1.5), appending each change to the variant log. A star with no embedding
// yet (extract/embed still pending) has no PE basis, so reshaping is skipped — the
// recall is then the plain re-ignition of spec 11. The repository supplies a
// co-recall-context embedding when available; otherwise both embeddings match and
// the gate remains closed for isolated/no-context recalls.
func (s *Service) reconsolidate(ctx context.Context, userID, memoryID string) error {
	rc, err := s.repo.GetReshapeContext(ctx, userID, memoryID)
	if errors.Is(err, ErrNotFound) {
		return nil // no star+embedding → nothing to reshape (spec 11 re-ignition only)
	}
	if err != nil {
		return err
	}
	// PE gate. A degenerate (empty/zero-norm) embedding can't measure novelty →
	// pe 0 (no reshape), NOT pe 1 — cosineSim returns 0 for a zero-norm vector,
	// and "can't compare" must read as "no novelty".
	pe := peGate(rc.RecallEmbedding, rc.ConsolidatedEmbedding)
	if pe < peThreshold {
		return nil // novelty 없음 → 단순 재점화만(spec 11과 동일)
	}
	ageDays := time.Since(rc.CreatedAt).Hours() / 24
	magnitude := reshapeStep(pe, strengthOf(rc.CoRecall, ageDays))
	// Direction comes from the RECALLED star (acceptance 1.2). Direct neighbors are
	// pulled along in the SAME direction — "this memory re-shaped its neighbors with
	// it" — rather than each drifting by its own id parity.
	dir := directionFor(memoryID, rc.State.Version)

	// The recalled star: full-size step.
	if err := s.applyAndLog(ctx, userID, memoryID, rc.State, pe, magnitude, dir, 1.0); err != nil {
		return err
	}

	// Direct neighbors (1-hop): reduced step, each appended too.
	neighbors, err := s.repo.ListDirectNeighbors(ctx, userID, memoryID)
	if err != nil {
		return err
	}
	for _, nID := range neighbors {
		nc, err := s.repo.GetReshapeContext(ctx, userID, nID)
		if errors.Is(err, ErrNotFound) {
			continue // a neighbor without an embedding yet — skip, never break the recall
		}
		if err != nil {
			return err
		}
		if err := s.applyAndLog(ctx, userID, nID, nc.State, pe, magnitude, dir, neighborFactor); err != nil {
			return err
		}
	}
	return nil
}

// applyAndLog reshapes one star (step scaled by factor) and appends the resulting
// state to the append-only variant log AS ONE ATOMIC UNIT (repo.ReshapeStar wraps both
// writes in a transaction) so version and the variant log can never diverge — a crash
// between the UPDATE and the INSERT would otherwise bump version with no matching row.
func (s *Service) applyAndLog(ctx context.Context, userID, memoryID string, prev ReshapeState, pe, magnitude float64, dir int, factor float64) error {
	next := reshapeState(prev, magnitude, dir, factor)
	return s.repo.ReshapeStar(ctx, userID, memoryID, next, EvolutionSnapshot{
		Version:       next.Version,
		Brightness:    next.BrightnessOffset,
		HueShift:      next.HueShift,
		FormSeedDelta: next.FormSeedDelta,
		Trigger:       "recall",
		PE:            pe,
		Dir:           dir,
	})
}

// GetEvolutionHistory returns a star's append-only variant log, version ascending
// (spec 23; the timelapse UI is spec 24). user_id isolation is enforced in the query.
func (s *Service) GetEvolutionHistory(ctx context.Context, userID, memoryID string) ([]EvolutionSnapshot, error) {
	return s.repo.GetEvolutionHistory(ctx, userID, memoryID)
}
