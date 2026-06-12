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
func (s *stubRepo) TouchRecall(context.Context, string, string) error { return nil }
func (s *stubRepo) GetRecord(context.Context, string, string) (Record, error) {
	return Record{}, ErrNotFound
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
