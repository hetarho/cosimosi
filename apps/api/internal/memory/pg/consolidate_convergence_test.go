package pg

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Convergence coverage: pending gist rises, the fenced semanticize
// completion transaction, the database guards on semanticized 변천사, and the
// per-user consolidation watermark.

type provenanceEvent struct {
	Text         string
	Stage        *int16
	UniverseTime time.Time
}

func readSemanticProvenance(t *testing.T, pool *platformdb.Pool, userID, memoryID string) []provenanceEvent {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rows, err := pool.PgxPool().Query(ctx, `
		SELECT text, semantic_stage, universe_time
		FROM memory_provenance
		WHERE user_id = $1 AND episodic_memory_id = $2 AND kind = 'semanticized'
		ORDER BY universe_time, created_at, id`, userID, memoryID)
	if err != nil {
		t.Fatalf("read semanticized provenance failed: %v", err)
	}
	defer rows.Close()
	events := []provenanceEvent{}
	for rows.Next() {
		var event provenanceEvent
		if err := rows.Scan(&event.Text, &event.Stage, &event.UniverseTime); err != nil {
			t.Fatalf("scan provenance failed: %v", err)
		}
		event.UniverseTime = event.UniverseTime.UTC()
		events = append(events, event)
	}
	return events
}

func seedConvergenceMemory(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, base string) memory.EpisodicMemory {
	t.Helper()
	day := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "convergence day", DiaryDate: day, CreatedAt: day})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	seed := int64(7)
	episodicMemory, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m1", DiaryID: diary.ID, Name: "Harbor", CurrentText: "a harbor account with enough words",
		Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory failed: %v", err)
	}
	return episodicMemory
}

func TestCompleteSemanticizeJobFinalizesPendingRiseExactlyOnce(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-sem-complete-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	episodicMemory := seedConvergenceMemory(t, ctx, store, scope, base)
	riseAt := time.Date(2026, 5, 21, 0, 0, 0, 0, time.UTC)

	// The advance recorded a deferred rise to stage 2 (missing ladder).
	if err := store.RecordPendingGistRises(ctx, scope, []memory.PendingGistRise{
		{MemoryID: episodicMemory.ID, Stage: 2, RiseAt: riseAt},
	}); err != nil {
		t.Fatalf("RecordPendingGistRises failed: %v", err)
	}
	job := enqueueRunningJobFixture(t, ctx, store, scope, memory.Job{
		ID: base + "-job", Kind: memory.JobKindSemanticize, Payload: []byte(`{}`),
		Status: memory.JobStatusPending, NextRunAt: riseAt, CreatedAt: riseAt,
		Targets: []memory.JobTarget{{Kind: memory.JobTargetMemory, ID: episodicMemory.ID, ExpectedRevision: 1}},
	})

	generated := memory.SemanticStages{"one", "two", "three", "four"}
	if err := store.CompleteSemanticizeJob(ctx, job, episodicMemory.ID, 1, generated); err != nil {
		t.Fatalf("CompleteSemanticizeJob failed: %v", err)
	}

	var stage int16
	var pendingStage *int16
	var pendingRise *time.Time
	var stagesJSON string
	var jobStatus string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stage, pending_semantic_stage, pending_semantic_rise_at, semantic_stages::text
		FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID).
		Scan(&stage, &pendingStage, &pendingRise, &stagesJSON); err != nil {
		t.Fatalf("read finalized memory failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT status FROM jobs WHERE user_id = $1 AND id = $2`, userID, job.ID).Scan(&jobStatus); err != nil {
		t.Fatalf("read job failed: %v", err)
	}
	if stage != 2 || pendingStage != nil || pendingRise != nil {
		t.Fatalf("finalized = stage %d pending %v/%v, want visible stage 2 with pending cleared", stage, pendingStage, pendingRise)
	}
	if stagesJSON != `["one", "two", "three", "four"]` {
		t.Fatalf("stored ladder = %s", stagesJSON)
	}
	if jobStatus != "done" {
		t.Fatalf("job status = %q, want done in the same transaction", jobStatus)
	}
	events := readSemanticProvenance(t, pool, userID, episodicMemory.ID)
	if len(events) != 2 {
		t.Fatalf("semanticized events = %d, want exactly one per newly materialized stage", len(events))
	}
	for i, event := range events {
		if event.Stage == nil || int(*event.Stage) != i+1 || event.Text != generated[i] || !event.UniverseTime.Equal(riseAt) {
			t.Fatalf("event[%d] = %+v, want stage %d text %q at the crossing %v", i, event, i+1, generated[i], riseAt)
		}
	}

	// Replaying the committed completion is a no-op: the job is no longer running,
	// so no second event, no ladder rewrite, no error.
	if err := store.CompleteSemanticizeJob(ctx, job, episodicMemory.ID, 1, memory.SemanticStages{"NEW-1", "NEW-2", "NEW-3", "NEW-4"}); err != nil {
		t.Fatalf("replayed completion errored: %v", err)
	}
	if events := readSemanticProvenance(t, pool, userID, episodicMemory.ID); len(events) != 2 {
		t.Fatalf("replay appended events: %d", len(events))
	}
	var stagesAfterReplay string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stages::text FROM episodic_memories WHERE user_id = $1 AND id = $2`,
		userID, episodicMemory.ID).Scan(&stagesAfterReplay); err != nil {
		t.Fatalf("read ladder after replay failed: %v", err)
	}
	if stagesAfterReplay != stagesJSON {
		t.Fatalf("replay rewrote the ladder: %s", stagesAfterReplay)
	}

	// A lost lease applies no side effect either.
	stale := job
	stale.LeaseGeneration--
	if err := store.CompleteSemanticizeJob(ctx, stale, episodicMemory.ID, 1, generated); err != nil {
		t.Fatalf("stale-lease completion errored: %v", err)
	}
}

func TestCompleteSemanticizeJobMergesLiveKeptStagesAndFencesRevision(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-sem-merge-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	episodicMemory := seedConvergenceMemory(t, ctx, store, scope, base)
	day := time.Date(2026, 5, 21, 0, 0, 0, 0, time.UTC)

	// The memory is visibly risen to stage 2 with history-backed texts; a
	// reconsolidation regen must not overwrite them.
	setSemanticStagesFixture(t, ctx, store, userID, episodicMemory.ID, memory.SemanticStages{"keep-1", "keep-2", "old-3", "old-4"})
	if _, err := pool.PgxPool().Exec(ctx, `
		UPDATE episodic_memories SET semantic_stage = 2 WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID); err != nil {
		t.Fatalf("set risen stage failed: %v", err)
	}
	job := enqueueRunningJobFixture(t, ctx, store, scope, memory.Job{
		ID: base + "-job", Kind: memory.JobKindSemanticize, Payload: []byte(`{}`),
		Status: memory.JobStatusPending, NextRunAt: day, CreatedAt: day,
		Targets: []memory.JobTarget{{Kind: memory.JobTargetMemory, ID: episodicMemory.ID, ExpectedRevision: 1}},
	})
	if err := store.CompleteSemanticizeJob(ctx, job, episodicMemory.ID, 1, memory.SemanticStages{"gen-1", "gen-2", "gen-3", "gen-4"}); err != nil {
		t.Fatalf("CompleteSemanticizeJob failed: %v", err)
	}
	var stagesJSON string
	var stage int16
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stages::text, semantic_stage FROM episodic_memories WHERE user_id = $1 AND id = $2`,
		userID, episodicMemory.ID).Scan(&stagesJSON, &stage); err != nil {
		t.Fatalf("read merged ladder failed: %v", err)
	}
	if stagesJSON != `["keep-1", "keep-2", "gen-3", "gen-4"]` || stage != 2 {
		t.Fatalf("merged = %s at stage %d, want live kept prefix + regenerated tail at stage 2", stagesJSON, stage)
	}
	if events := readSemanticProvenance(t, pool, userID, episodicMemory.ID); len(events) != 0 {
		t.Fatalf("no rise was pending, yet %d events appended", len(events))
	}

	// Revision fence: a delayed job for a superseded representation writes nothing
	// and leaves its own row running (its terminal transition is the worker's call).
	if _, err := pool.PgxPool().Exec(ctx, `
		UPDATE episodic_memories SET current_text = 'rewritten', representation_revision = 2
		WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID); err != nil {
		t.Fatalf("supersede failed: %v", err)
	}
	staleJob := enqueueRunningJobFixture(t, ctx, store, scope, memory.Job{
		ID: base + "-job-stale", Kind: memory.JobKindSemanticize, Payload: []byte(`{}`),
		Status: memory.JobStatusPending, NextRunAt: day, CreatedAt: day,
		Targets: []memory.JobTarget{{Kind: memory.JobTargetMemory, ID: episodicMemory.ID, ExpectedRevision: 1}},
	})
	if err := store.CompleteSemanticizeJob(ctx, staleJob, episodicMemory.ID, 1, memory.SemanticStages{"STALE-1", "STALE-2", "STALE-3", "STALE-4"}); err != nil {
		t.Fatalf("stale completion errored: %v", err)
	}
	var after string
	var staleStatus string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stages::text FROM episodic_memories WHERE user_id = $1 AND id = $2`,
		userID, episodicMemory.ID).Scan(&after); err != nil {
		t.Fatalf("read ladder after stale completion failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT status FROM jobs WHERE user_id = $1 AND id = $2`, userID, staleJob.ID).Scan(&staleStatus); err != nil {
		t.Fatalf("read stale job failed: %v", err)
	}
	if after != stagesJSON || staleStatus != "running" {
		t.Fatalf("stale completion = ladder %s job %q, want untouched ladder and a still-running job", after, staleStatus)
	}
}

func TestProvenanceGuardsRefuseBlankAndDuplicateStageEvents(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-prov-guard-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	episodicMemory := seedConvergenceMemory(t, ctx, store, scope, base)
	day := time.Date(2026, 5, 21, 0, 0, 0, 0, time.UTC)
	stageOne := int16(1)

	// Blank text on a new semanticized event is refused by the database itself.
	err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-blank", EpisodicMemoryID: episodicMemory.ID,
		Kind: memory.ProvenanceKindSemanticized, Source: memory.ProvenanceSourceSystem,
		Text: "   ", UniverseTime: day, SemanticStage: &stageOne,
	})
	if err == nil {
		t.Fatal("blank semanticized event was accepted")
	}
	// So is a semanticized event without its stage identity.
	err = store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-stageless", EpisodicMemoryID: episodicMemory.ID,
		Kind: memory.ProvenanceKindSemanticized, Source: memory.ProvenanceSourceSystem,
		Text: "gist", UniverseTime: day,
	})
	if err == nil {
		t.Fatal("stage-less semanticized event was accepted")
	}

	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-ok", EpisodicMemoryID: episodicMemory.ID,
		Kind: memory.ProvenanceKindSemanticized, Source: memory.ProvenanceSourceSystem,
		Text: "gist", UniverseTime: day, SemanticStage: &stageOne,
	}); err != nil {
		t.Fatalf("valid semanticized event refused: %v", err)
	}
	// A second event for the same stage is a replay/race bug and is refused.
	err = store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-dup", EpisodicMemoryID: episodicMemory.ID,
		Kind: memory.ProvenanceKindSemanticized, Source: memory.ProvenanceSourceSystem,
		Text: "gist again", UniverseTime: day.AddDate(0, 0, 1), SemanticStage: &stageOne,
	})
	if err == nil {
		t.Fatal("duplicate stage event was accepted")
	}

	// Stage-less reconsolidated rows stay unrestricted (the legacy/user history shape).
	for i := 0; i < 2; i++ {
		if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
			ID: fmt.Sprintf("%s-recon-%d", base, i), EpisodicMemoryID: episodicMemory.ID,
			Kind: memory.ProvenanceKindReconsolidated, Source: memory.ProvenanceSourceUser,
			Text: "rewritten", UniverseTime: day,
		}); err != nil {
			t.Fatalf("reconsolidated append %d refused: %v", i, err)
		}
	}
}

func TestConsolidationWatermarkIsScopedMonotoneAndRollbackRetryable(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-watermark-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherID := base + "-other"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, otherID)
	scope, _ := platform.NewUserScope(userID)
	otherScope, _ := platform.NewUserScope(otherID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	for _, s := range []platform.UserScope{scope, otherScope} {
		if _, err := store.AdvanceUniverseClock(ctx, s, day); err != nil {
			t.Fatalf("AdvanceUniverseClock failed: %v", err)
		}
	}

	readWatermark := func(id string) *time.Time {
		var through *time.Time
		if err := pool.PgxPool().QueryRow(ctx, `
			SELECT consolidated_through FROM universe_state WHERE user_id = $1`, id).Scan(&through); err != nil {
			t.Fatalf("read watermark %s failed: %v", id, err)
		}
		return through
	}

	if err := store.SetConsolidationWatermark(ctx, scope, day.AddDate(0, 0, 10)); err != nil {
		t.Fatalf("SetConsolidationWatermark failed: %v", err)
	}
	// Monotone: an older interval end can never rewind the marker.
	if err := store.SetConsolidationWatermark(ctx, scope, day.AddDate(0, 0, 5)); err != nil {
		t.Fatalf("SetConsolidationWatermark (older) failed: %v", err)
	}
	if got := readWatermark(userID); got == nil || !got.UTC().Equal(day.AddDate(0, 0, 10)) {
		t.Fatalf("watermark = %v, want the GREATEST-held day+10", got)
	}
	// Scoped: the other user's marker is untouched.
	if got := readWatermark(otherID); got != nil {
		t.Fatalf("other user's watermark = %v, want NULL", got)
	}

	// A rolled-back attempt leaves the marker (and the interval) retryable.
	tx, err := pool.PgxPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		t.Fatalf("BeginTx failed: %v", err)
	}
	txStore := NewStore(tx)
	if err := txStore.SetConsolidationWatermark(ctx, scope, day.AddDate(0, 0, 30)); err != nil {
		t.Fatalf("tx SetConsolidationWatermark failed: %v", err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}
	if got := readWatermark(userID); got == nil || !got.UTC().Equal(day.AddDate(0, 0, 10)) {
		t.Fatalf("watermark after rollback = %v, want unchanged day+10", got)
	}

	// The locked read errors loudly when no universe_state row exists — the hook can
	// only legally fire after the advance upserted it.
	ghostScope, _ := platform.NewUserScope(base + "-ghost")
	if _, err := store.ConsolidationWatermarkForUpdate(ctx, ghostScope); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("ghost watermark err = %v, want ErrNoRows", err)
	}
}

// TestSyncDefersRiseThenWorkerMaterializesIt drives the full deferred-rise loop against a
// real database: a sync whose crossing finds no ladder publishes nothing (stage and 변천사
// untouched), records the pending rise, and enqueues regeneration; the worker's completion
// then materializes the rise with real text at the crossing's universe-time.
func TestSyncDefersRiseThenWorkerMaterializesIt(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-defer-rise-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	created := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	today := consolidateServiceDay()

	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion failed")
	}
	seed := int64(5)
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "ladderless day", DiaryDate: created, CreatedAt: created})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	episodicMemory, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m1", DiaryID: diary.ID, Name: "Ladderless",
		CurrentText: "the generation job died before the ladder ever landed",
		Seed:        &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: created,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory failed: %v", err)
	}
	if _, err := store.AdvanceUniverseClock(ctx, scope, created); err != nil {
		t.Fatalf("AdvanceUniverseClock failed: %v", err)
	}

	service := newConsolidateService(t, store)
	if _, err := service.SyncToToday(ctx, scope); err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}

	strength := memory.EffectiveStrength(0.5, 0)
	wantStage := memory.Semanticize(0, memory.GistUnitsElapsed(today, created, emotion.Arousal, strength))
	if wantStage < 1 {
		t.Fatal("fixture must cross at least one gist stage")
	}

	var stage, pendingStage int16
	var pendingRise time.Time
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stage, pending_semantic_stage, pending_semantic_rise_at
		FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID).
		Scan(&stage, &pendingStage, &pendingRise); err != nil {
		t.Fatalf("read deferred memory failed: %v", err)
	}
	if stage != 0 || int(pendingStage) != wantStage || !pendingRise.UTC().Equal(today) {
		t.Fatalf("deferred = stage %d pending %d at %v, want visible 0 and pending %d at today", stage, pendingStage, pendingRise, wantStage)
	}
	if events := readSemanticProvenance(t, pool, userID, episodicMemory.ID); len(events) != 0 {
		t.Fatalf("a ladderless crossing appended %d events, want none until text exists", len(events))
	}

	// The worker regenerates from live source and its completion materializes the rise.
	runner, err := memory.NewDefaultJobRunner(store, ai.NewMockEmbedder(), ai.NewMockSemanticizer(), time.Millisecond, nil)
	if err != nil {
		t.Fatalf("NewDefaultJobRunner failed: %v", err)
	}
	worked, err := runner.RunOnce(ctx)
	if err != nil || !worked {
		t.Fatalf("RunOnce = (%t, %v), want a claimed semanticize job", worked, err)
	}

	var stagesJSON *string
	var pendingAfter *int16
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stage, pending_semantic_stage, semantic_stages::text
		FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID).
		Scan(&stage, &pendingAfter, &stagesJSON); err != nil {
		t.Fatalf("read materialized memory failed: %v", err)
	}
	if int(stage) != wantStage || pendingAfter != nil || stagesJSON == nil {
		t.Fatalf("materialized = stage %d pending %v ladder %v, want stage %d with a stored ladder and no pending", stage, pendingAfter, stagesJSON, wantStage)
	}
	events := readSemanticProvenance(t, pool, userID, episodicMemory.ID)
	if len(events) != wantStage {
		t.Fatalf("events = %d, want one per materialized stage %d", len(events), wantStage)
	}
	for i, event := range events {
		if event.Stage == nil || int(*event.Stage) != i+1 || event.Text == "" || !event.UniverseTime.Equal(today) {
			t.Fatalf("event[%d] = %+v, want non-empty stage %d at the crossing", i, event, i+1)
		}
	}
}

func TestRecordPendingGistRisesExtendsAndKeepsFirstCrossing(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-pending-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherID := base + "-other"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, otherID)
	scope, _ := platform.NewUserScope(userID)
	otherScope, _ := platform.NewUserScope(otherID)
	store := NewStore(pool.PgxPool())
	episodicMemory := seedConvergenceMemory(t, ctx, store, scope, base)
	first := time.Date(2026, 5, 21, 0, 0, 0, 0, time.UTC)
	later := first.AddDate(0, 0, 10)

	if err := store.RecordPendingGistRises(ctx, scope, []memory.PendingGistRise{
		{MemoryID: episodicMemory.ID, Stage: 2, RiseAt: first},
	}); err != nil {
		t.Fatalf("first RecordPendingGistRises failed: %v", err)
	}
	// The extension raises the target but keeps the FIRST crossing's event time; a
	// lower stage can never shrink the target.
	if err := store.RecordPendingGistRises(ctx, scope, []memory.PendingGistRise{
		{MemoryID: episodicMemory.ID, Stage: 3, RiseAt: later},
	}); err != nil {
		t.Fatalf("extension failed: %v", err)
	}
	if err := store.RecordPendingGistRises(ctx, scope, []memory.PendingGistRise{
		{MemoryID: episodicMemory.ID, Stage: 1, RiseAt: later},
	}); err != nil {
		t.Fatalf("lower re-record failed: %v", err)
	}
	var stage int16
	var riseAt time.Time
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT pending_semantic_stage, pending_semantic_rise_at
		FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, episodicMemory.ID).
		Scan(&stage, &riseAt); err != nil {
		t.Fatalf("read pending failed: %v", err)
	}
	if stage != 3 || !riseAt.UTC().Equal(first) {
		t.Fatalf("pending = stage %d at %v, want extended stage 3 anchored at the first crossing %v", stage, riseAt, first)
	}

	// Another user's write cannot touch this row.
	if err := store.RecordPendingGistRises(ctx, otherScope, []memory.PendingGistRise{
		{MemoryID: episodicMemory.ID, Stage: 4, RiseAt: later},
	}); err != nil {
		t.Fatalf("cross-user record failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT pending_semantic_stage FROM episodic_memories WHERE user_id = $1 AND id = $2`,
		userID, episodicMemory.ID).Scan(&stage); err != nil {
		t.Fatalf("re-read pending failed: %v", err)
	}
	if stage != 3 {
		t.Fatalf("cross-user write moved the pending stage to %d", stage)
	}
}
