package memory

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// fakeAchievementRecorder records what each producing path reported, so the emissions can be asserted
// as facts rather than inferred from a counter table.
type fakeAchievementRecorder struct {
	reports []achievementReport
	failOn  string
}

type achievementReport struct {
	CounterKey string
	Delta      int
	TxAbsent   bool
}

func (f *fakeAchievementRecorder) RecordProgress(
	_ context.Context,
	_ platform.UserScope,
	tx EconomyTx,
	counterKey string,
	delta int,
) error {
	if counterKey == f.failOn {
		return errors.New("recorder refused " + counterKey)
	}
	f.reports = append(f.reports, achievementReport{CounterKey: counterKey, Delta: delta, TxAbsent: tx == nil})
	return nil
}

func (f *fakeAchievementRecorder) delta(counterKey string) (int, bool) {
	total := 0
	found := false
	for _, report := range f.reports {
		if report.CounterKey == counterKey {
			total += report.Delta
			found = true
		}
	}
	return total, found
}

// A past-dated diary is SAVED and counts nothing: the reports sit after the monotonic launch guard,
// at the same point as the write-earn grant ([I10][T1]). Anything else is the invite farm renamed.
func TestPastDatedDiaryReportsNoProgress(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	scope := testScope(t)
	// The first launch moves the clock forward; the second is dated before it and launches nothing.
	if _, err := fixture.service.PersistEncoded(context.Background(), scope, testDiaryBody, testDiaryDate(), confirmedFixture()); err != nil {
		t.Fatalf("first launch failed: %v", err)
	}
	fixture.achievements.reports = nil
	result, err := fixture.service.PersistEncoded(
		context.Background(),
		scope,
		testDiaryBody,
		testDiaryDate().AddDate(0, 0, -3),
		confirmedFixture(),
	)
	if err != nil {
		t.Fatalf("past-dated launch failed: %v", err)
	}
	if !result.PastDated {
		t.Fatal("the fixture did not produce a past-dated launch")
	}
	if len(fixture.achievements.reports) != 0 {
		t.Fatalf("a past-dated diary reported %v", fixture.achievements.reports)
	}
}

// The launch reports one diary, its memories, its moods, and the two sharing facts — each inside the
// launch transaction.
func TestLaunchReportsItsCounterFacts(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.service.PersistEncoded(
		context.Background(),
		testScope(t),
		testDiaryBody,
		testDiaryDate(),
		confirmedFixture(),
	); err != nil {
		t.Fatalf("launch failed: %v", err)
	}
	if delta, ok := fixture.achievements.delta(CounterDiaryWritten); !ok || delta != 1 {
		t.Fatalf("diary_written = %d (%v), want exactly 1 per launched diary", delta, ok)
	}
	launched, _ := fixture.achievements.delta(CounterEpisodicMemoryLaunched)
	if launched != len(confirmedFixture()) {
		t.Fatalf("episodic_memory_launched = %d, want the launched row count %d", launched, len(confirmedFixture()))
	}
	moods := 0
	for _, report := range fixture.achievements.reports {
		if strings.HasPrefix(report.CounterKey, counterMoodRecordedPrefix) {
			moods += report.Delta
		}
		if report.TxAbsent {
			t.Fatalf("%s was reported outside the launch transaction", report.CounterKey)
		}
	}
	if moods != len(confirmedFixture()) {
		t.Fatalf("mood family reports = %d, want one per memory %d", moods, len(confirmedFixture()))
	}
}

// A recorder failure aborts the launch. Deliberate: there is no recompute path, so a counter that can
// silently diverge from the facts would be unfixable later.
func TestARecorderFailureRollsBackTheLaunch(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.achievements.failOn = CounterDiaryWritten
	if _, err := fixture.service.PersistEncoded(
		context.Background(),
		testScope(t),
		testDiaryBody,
		testDiaryDate(),
		confirmedFixture(),
	); err == nil {
		t.Fatal("a refused counter report did not fail the launch")
	}
	if len(fixture.launches.committed.diaries) != 0 || len(fixture.launches.committed.memories) != 0 {
		t.Fatal("the launch committed despite a refused counter report")
	}
}

// The 망각·회복 judgement is made from the PRE-recall anchor, and only at or above the configured
// stage. The stage itself never crosses the port.
func TestRecallRecoversDecayOnlyAtTheConfiguredStage(t *testing.T) {
	t.Parallel()
	universeTime := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	// A memory recalled a moment ago is vivid — stage 0.
	vivid := DiaryRecallAnchor{
		EpisodicMemoryID:         "m-vivid",
		Arousal:                  0.5,
		BaseStrength:             1,
		CreatedUniverseTime:      universeTime,
		LastRecalledUniverseTime: &universeTime,
	}
	if recallRecoversDecay(vivid, universeTime) {
		t.Fatal("a vivid memory counted as a recovery")
	}
	// One born long enough ago has crossed the stage the value names.
	born := universeTime.AddDate(-5, 0, 0)
	faded := DiaryRecallAnchor{
		EpisodicMemoryID:    "m-faded",
		Arousal:             0.5,
		BaseStrength:        1,
		CreatedUniverseTime: born,
	}
	if !recallRecoversDecay(faded, universeTime) {
		t.Fatalf("a five-year-old memory did not reach stage %d", values.AchievementRecoveryDecayStageMin)
	}
}
