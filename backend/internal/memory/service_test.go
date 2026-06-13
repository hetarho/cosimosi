package memory

import (
	"context"
	"errors"
	"math"
	"strings"
	"testing"
	"time"
)

// stubRepo records the last RecordMemory input; reads are unused by these tests.
type stubRepo struct {
	lastInput *RecordInput
}

func (s *stubRepo) RecordMemory(_ context.Context, in RecordInput) (string, []string, error) {
	s.lastInput = &in
	return "rec-1", nil, nil
}
func (s *stubRepo) ListByUser(context.Context, string) ([]Memory, error) { return nil, nil }
func (s *stubRepo) ListDormant(context.Context, string, time.Time) ([]Memory, error) {
	return nil, nil
}
func (s *stubRepo) ListRecentForAmbient(context.Context, string, time.Time) ([]EmotionSample, error) {
	return nil, nil
}
func (s *stubRepo) ListStarVectorsByUser(context.Context, string) ([]StarVector, error) {
	return nil, nil
}
func (s *stubRepo) TouchRecall(context.Context, string, string) error { return nil }
func (s *stubRepo) GetRecord(context.Context, string, string) (Record, error) {
	return Record{}, ErrNotFound
}
func (s *stubRepo) GetReshapeContext(context.Context, string, string) (ReshapeContext, error) {
	return ReshapeContext{}, ErrNotFound
}
func (s *stubRepo) ListDirectNeighbors(context.Context, string, string) ([]string, error) {
	return nil, nil
}
func (s *stubRepo) ReshapeStar(context.Context, string, string, ReshapeState, EvolutionSnapshot) error {
	return nil
}
func (s *stubRepo) GetEvolutionHistory(context.Context, string, string) ([]EvolutionSnapshot, error) {
	return nil, nil
}

func newTestService() (*Service, *stubRepo) {
	repo := &stubRepo{}
	return NewService(repo, nil, nil), repo
}

// Validation rejects bad input BEFORE the repository runs (records are
// append-only — constitution §1; acceptance 2.4/2.5).
func TestRecordMemoryValidation(t *testing.T) {
	cases := []struct {
		name    string
		in      RecordInput
		wantErr error
	}{
		{"empty body", RecordInput{Body: ""}, ErrEmptyBody},
		{"whitespace-only body", RecordInput{Body: " \n\t "}, ErrEmptyBody},
		{"body at cap passes", RecordInput{Body: strings.Repeat("가", MaxBodyRunes), Intensity: 0.5}, nil},
		{"body over cap", RecordInput{Body: strings.Repeat("가", MaxBodyRunes+1), Intensity: 0.5}, ErrBodyTooLong},
		{"intensity below 0", RecordInput{Body: "ok", Intensity: -0.01}, ErrIntensityRange},
		{"intensity above 1", RecordInput{Body: "ok", Intensity: 1.01}, ErrIntensityRange},
		{"intensity NaN", RecordInput{Body: "ok", Intensity: math.NaN()}, ErrIntensityRange},
		{"intensity 0 passes", RecordInput{Body: "ok", Intensity: 0}, nil},
		{"intensity 1 passes", RecordInput{Body: "ok", Intensity: 1}, nil},
		{"valence below -1", RecordInput{Body: "ok", Valence: -1.01}, ErrValenceRange},
		{"valence above 1", RecordInput{Body: "ok", Valence: 1.01}, ErrValenceRange},
		{"valence NaN", RecordInput{Body: "ok", Valence: math.NaN()}, ErrValenceRange},
		{"valence bounds pass", RecordInput{Body: "ok", Valence: -1}, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			svc, repo := newTestService()
			_, _, err := svc.RecordMemory(context.Background(), c.in)
			if !errors.Is(err, c.wantErr) {
				t.Fatalf("RecordMemory err = %v, want %v", err, c.wantErr)
			}
			if c.wantErr != nil && repo.lastInput != nil {
				t.Fatalf("repository ran despite validation error %v — no record/memory/job must be created (2.4)", c.wantErr)
			}
			if c.wantErr == nil && repo.lastInput == nil {
				t.Fatal("repository did not run for valid input")
			}
		})
	}
}

// The FE picks Korean error copy by substring-matching these sentinel texts
// (record-memory.ts, 17). This pin turns a silent UX regression (reworded Go
// error → generic FE message) into a failing test.
func TestValidationSentinelTextPinned(t *testing.T) {
	pins := map[string]error{
		"body is empty":      ErrEmptyBody,
		"exceeds max length": ErrBodyTooLong,
		"intensity":          ErrIntensityRange,
	}
	for want, err := range pins {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("sentinel %q lost FE-matched substring %q — update record-memory.ts together", err, want)
		}
	}
}

// --- reconsolidation reshaping (spec 23) ---

// reshapeRepo is a fake driving the reconsolidation flow without a DB: GetReshapeContext
// serves per-id contexts, ListDirectNeighbors serves the 1-hop set, and ApplyReshape /
// AppendEvolution record which stars were touched (acceptance 1.5 scope check).
type reshapeRepo struct {
	ctxByID   map[string]ReshapeContext
	neighbors map[string][]string
	applied   map[string]ReshapeState
	appended  map[string][]EvolutionSnapshot
	reshapeErr error // when set, ReshapeStar fails (best-effort recall must still return the record)
}

func newReshapeRepo() *reshapeRepo {
	return &reshapeRepo{
		ctxByID:   map[string]ReshapeContext{},
		neighbors: map[string][]string{},
		applied:   map[string]ReshapeState{},
		appended:  map[string][]EvolutionSnapshot{},
	}
}

func (r *reshapeRepo) RecordMemory(context.Context, RecordInput) (string, []string, error) {
	return "", nil, nil
}
func (r *reshapeRepo) ListByUser(context.Context, string) ([]Memory, error) { return nil, nil }
func (r *reshapeRepo) ListDormant(context.Context, string, time.Time) ([]Memory, error) {
	return nil, nil
}
func (r *reshapeRepo) ListRecentForAmbient(context.Context, string, time.Time) ([]EmotionSample, error) {
	return nil, nil
}
func (r *reshapeRepo) ListStarVectorsByUser(context.Context, string) ([]StarVector, error) {
	return nil, nil
}
func (r *reshapeRepo) TouchRecall(context.Context, string, string) error { return nil }
func (r *reshapeRepo) GetRecord(context.Context, string, string) (Record, error) {
	return Record{Body: "original", Mood: MoodJoy, Intensity: 0.5}, nil
}
func (r *reshapeRepo) GetReshapeContext(_ context.Context, _, memoryID string) (ReshapeContext, error) {
	rc, ok := r.ctxByID[memoryID]
	if !ok {
		return ReshapeContext{}, ErrNotFound
	}
	return rc, nil
}
func (r *reshapeRepo) ListDirectNeighbors(_ context.Context, _, memoryID string) ([]string, error) {
	return r.neighbors[memoryID], nil
}
func (r *reshapeRepo) ReshapeStar(_ context.Context, _, memoryID string, st ReshapeState, snap EvolutionSnapshot) error {
	if r.reshapeErr != nil {
		return r.reshapeErr
	}
	r.applied[memoryID] = st
	r.appended[memoryID] = append(r.appended[memoryID], snap)
	return nil
}
func (r *reshapeRepo) GetEvolutionHistory(context.Context, string, string) ([]EvolutionSnapshot, error) {
	return nil, nil
}

// 1.1: a recall with no novelty (pe < threshold; here both embeddings equal → pe 0)
// re-ignites only — no reshape, no evolution row.
func TestRecallNoNoveltyDoesNotReshape(t *testing.T) {
	repo := newReshapeRepo()
	emb := []float64{1, 0, 0}
	repo.ctxByID["m1"] = ReshapeContext{RecallEmbedding: emb, ConsolidatedEmbedding: emb}
	svc := NewService(repo, nil, nil)
	if _, err := svc.RecallMemory(context.Background(), "u1", "m1"); err != nil {
		t.Fatalf("RecallMemory = %v, want nil", err)
	}
	if len(repo.applied) != 0 || len(repo.appended) != 0 {
		t.Fatalf("pe<threshold must not reshape: applied=%v appended=%v", repo.applied, repo.appended)
	}
}

// 1.5: a novel recall reshapes the recalled star + its DIRECT neighbors only; an
// indirect star (not in the 1-hop set) stays untouched.
func TestRecallReshapesStarAndDirectNeighborsOnly(t *testing.T) {
	repo := newReshapeRepo()
	// Orthogonal embeddings → cos 0 → pe 1 (novel).
	repo.ctxByID["m1"] = ReshapeContext{RecallEmbedding: []float64{1, 0}, ConsolidatedEmbedding: []float64{0, 1}}
	repo.ctxByID["n1"] = ReshapeContext{RecallEmbedding: []float64{1, 0}, ConsolidatedEmbedding: []float64{0, 1}}
	repo.ctxByID["n2-indirect"] = ReshapeContext{RecallEmbedding: []float64{1, 0}, ConsolidatedEmbedding: []float64{0, 1}}
	repo.neighbors["m1"] = []string{"n1"} // n2-indirect is NOT a 1-hop neighbor
	svc := NewService(repo, nil, nil)
	if _, err := svc.RecallMemory(context.Background(), "u1", "m1"); err != nil {
		t.Fatalf("RecallMemory = %v, want nil", err)
	}
	if _, ok := repo.applied["m1"]; !ok {
		t.Fatal("recalled star m1 must be reshaped")
	}
	if _, ok := repo.applied["n1"]; !ok {
		t.Fatal("direct neighbor n1 must be reshaped")
	}
	if _, ok := repo.applied["n2-indirect"]; ok {
		t.Fatal("indirect star must NOT be reshaped (content-limited scope, 1.5)")
	}
	// Each reshaped star gets exactly one append (1.4), version bumped to 1.
	for _, id := range []string{"m1", "n1"} {
		if got := len(repo.appended[id]); got != 1 {
			t.Fatalf("%s: appended %d evolution rows, want 1", id, got)
		}
		if repo.applied[id].Version != 1 {
			t.Fatalf("%s: version = %d, want 1", id, repo.applied[id].Version)
		}
	}
	// The neighbor moves a SMALLER brightness step than the recalled star (1.5).
	if math.Abs(repo.applied["n1"].BrightnessOffset) >= math.Abs(repo.applied["m1"].BrightnessOffset) {
		t.Fatalf("neighbor step (%v) must be smaller than recalled star step (%v)",
			repo.applied["n1"].BrightnessOffset, repo.applied["m1"].BrightnessOffset)
	}
}

// Reshaping is best-effort: a reshape WRITE failure must NOT deny the user their
// immutable original (the spec-11 recall contract) — RecallMemory still returns the
// Record. (The path is novel: orthogonal embeddings → pe 1 → reshape attempted.)
func TestRecallReshapeFailureStillReturnsRecord(t *testing.T) {
	repo := newReshapeRepo()
	repo.ctxByID["m1"] = ReshapeContext{RecallEmbedding: []float64{1, 0}, ConsolidatedEmbedding: []float64{0, 1}}
	repo.reshapeErr = errors.New("transient db error")
	svc := NewService(repo, nil, nil)
	rec, err := svc.RecallMemory(context.Background(), "u1", "m1")
	if err != nil {
		t.Fatalf("RecallMemory must succeed despite reshape failure, got %v", err)
	}
	if rec.Body != "original" {
		t.Fatalf("expected the immutable original, got %q", rec.Body)
	}
}

// A degenerate (zero-norm) embedding can't measure novelty → pe 0 → no reshape, NOT
// pe 1. Guards against reshaping on every recall when an embedding row is degenerate.
func TestRecallZeroEmbeddingDoesNotReshape(t *testing.T) {
	repo := newReshapeRepo()
	zero := []float64{0, 0, 0}
	repo.ctxByID["m1"] = ReshapeContext{RecallEmbedding: zero, ConsolidatedEmbedding: zero}
	svc := NewService(repo, nil, nil)
	if _, err := svc.RecallMemory(context.Background(), "u1", "m1"); err != nil {
		t.Fatalf("RecallMemory = %v, want nil", err)
	}
	if len(repo.applied) != 0 {
		t.Fatalf("zero-norm embedding must not reshape (pe must be 0, not 1): %v", repo.applied)
	}
}

// 1.2: a single reshape moves brightness by clamp(magnitude, 0.10, 0.22), keeps hue
// within ±28°, keeps form-seed within ±formDeltaMax, and bumps version.
func TestReshapeStateBounds(t *testing.T) {
	mag := reshapeStep(1.0, 0) // pe=1, strength=0 → baseStep
	for _, dir := range []int{+1, -1} {
		st := reshapeState(ReshapeState{}, mag, dir, 1.0)
		step := math.Abs(st.BrightnessOffset)
		if step < minBrightStep-1e-9 || step > maxBrightStep+1e-9 {
			t.Fatalf("brightness step %v out of [%v,%v]", step, minBrightStep, maxBrightStep)
		}
		if math.Abs(st.HueShift) > hueMaxDeg+1e-9 {
			t.Fatalf("hue %v exceeds ±%v", st.HueShift, hueMaxDeg)
		}
		if math.Abs(st.FormSeedDelta) > formDeltaMax+1e-9 {
			t.Fatalf("form-seed %v exceeds ±%v", st.FormSeedDelta, formDeltaMax)
		}
		if st.Version != 1 {
			t.Fatalf("version = %d, want 1", st.Version)
		}
	}
	// Repeated same-direction steps stay clamped to ±28° (never run away).
	st := ReshapeState{}
	for i := 0; i < 10; i++ {
		st = reshapeState(st, mag, +1, 1.0)
	}
	if st.HueShift > hueMaxDeg+1e-9 {
		t.Fatalf("accumulated hue %v exceeds +%v", st.HueShift, hueMaxDeg)
	}
}

// 1.3: at equal pe, a more consolidated star (higher co-recall / older) reshapes by a
// SMALLER magnitude — strength↑ ⇒ magnitude↓.
func TestReshapeStrengthDependence(t *testing.T) {
	const pe = 0.5
	weak := reshapeStep(pe, strengthOf(0, 0))      // never recalled, brand new
	strong := reshapeStep(pe, strengthOf(64, 365)) // recalled often, a year old
	if !(strong < weak) {
		t.Fatalf("strength↑ must shrink magnitude: strong=%v weak=%v", strong, weak)
	}
	if strong < 0 {
		t.Fatalf("magnitude must stay ≥0, got %v", strong)
	}
}

func TestCosineSim(t *testing.T) {
	if got := cosineSim([]float64{1, 0}, []float64{1, 0}); math.Abs(got-1) > 1e-9 {
		t.Fatalf("identical vectors cos = %v, want 1", got)
	}
	if got := cosineSim([]float64{1, 0}, []float64{0, 1}); math.Abs(got) > 1e-9 {
		t.Fatalf("orthogonal cos = %v, want 0", got)
	}
	if got := cosineSim(nil, nil); got != 0 {
		t.Fatalf("empty cos = %v, want 0", got)
	}
	if got := cosineSim([]float64{1, 2}, []float64{1}); got != 0 {
		t.Fatalf("length-mismatch cos = %v, want 0", got)
	}
	if got := cosineSim([]float64{0, 0}, []float64{1, 1}); got != 0 {
		t.Fatalf("zero-norm cos = %v, want 0", got)
	}
}

func TestDirectionForDeterministic(t *testing.T) {
	if directionFor("mem-x", 3) != directionFor("mem-x", 3) {
		t.Fatal("directionFor must be deterministic for the same (id, version)")
	}
	for _, d := range []int{directionFor("a", 0), directionFor("b", 1), directionFor("c", 7)} {
		if d != 1 && d != -1 {
			t.Fatalf("direction = %d, want ±1", d)
		}
	}
}

// A zero entry date defaults to now (UTC) — existing policy, kept after the
// validation was added in front of it.
func TestRecordMemoryDefaultsEntryDate(t *testing.T) {
	svc, repo := newTestService()
	if _, _, err := svc.RecordMemory(context.Background(), RecordInput{Body: "ok", Intensity: 0.5}); err != nil {
		t.Fatalf("RecordMemory = %v, want nil", err)
	}
	if repo.lastInput == nil || repo.lastInput.EntryDate.IsZero() {
		t.Fatal("EntryDate was not defaulted")
	}
}
