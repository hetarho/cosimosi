package pg

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/values"
)

type graphBarrierEarn struct {
	entered chan struct{}
	proceed chan struct{}
}

func (b graphBarrierEarn) OnDiaryLaunched(ctx context.Context, _ platform.UserScope, _ memory.EconomyTx, _ string) error {
	close(b.entered)
	select {
	case <-b.proceed:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

type graphBarrierSpendGate struct {
	next    memory.SpendGate
	once    sync.Once
	entered chan struct{}
	proceed chan struct{}
}

func (b *graphBarrierSpendGate) CheckAndSpend(ctx context.Context, scope platform.UserScope, tx memory.EconomyTx, spend memory.SpendIntent) error {
	b.once.Do(func() { close(b.entered) })
	select {
	case <-b.proceed:
		return b.next.CheckAndSpend(ctx, scope, tx, spend)
	case <-ctx.Done():
		return ctx.Err()
	}
}

type graphBarrierProgression struct {
	next    memory.AdvanceProgression
	once    sync.Once
	entered chan struct{}
	proceed chan struct{}
}

func (b *graphBarrierProgression) OnAdvance(ctx context.Context, scope platform.UserScope, tx memory.ProgressionTx, from *time.Time, to time.Time) error {
	b.once.Do(func() { close(b.entered) })
	select {
	case <-b.proceed:
		return b.next.OnAdvance(ctx, scope, tx, from, to)
	case <-ctx.Done():
		return ctx.Err()
	}
}

type graphBarrierReleaseRepo struct {
	memory.ReleaseRepo
	holdAt  int
	locks   int
	entered chan struct{}
	proceed chan struct{}
}

func (r *graphBarrierReleaseRepo) InReleaseTx(ctx context.Context, fn func(memory.ReleaseTx) error) error {
	return r.ReleaseRepo.InReleaseTx(ctx, func(tx memory.ReleaseTx) error {
		return fn(&graphBarrierReleaseTx{ReleaseTx: tx, repo: r})
	})
}

type graphBarrierReleaseTx struct {
	memory.ReleaseTx
	repo *graphBarrierReleaseRepo
}

func (tx *graphBarrierReleaseTx) LockGraphMutation(ctx context.Context, scope platform.UserScope) error {
	if err := tx.ReleaseTx.LockGraphMutation(ctx, scope); err != nil {
		return err
	}
	tx.repo.locks++
	if tx.repo.locks != tx.repo.holdAt {
		return nil
	}
	close(tx.repo.entered)
	select {
	case <-tx.repo.proceed:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func newGraphConcurrencyService(
	t *testing.T,
	store Store,
	releases memory.ReleaseRepo,
	earn memory.EarnPort,
	now func() time.Time,
) *memory.Service {
	t.Helper()
	return newGraphConcurrencyServiceWith(t, store, releases, memory.NoopAdvanceProgression{}, memory.AllowAllSpendGate{}, earn, now)
}

func newGraphConcurrencyServiceWith(
	t *testing.T,
	store Store,
	releases memory.ReleaseRepo,
	progression memory.AdvanceProgression,
	spendGate memory.SpendGate,
	earn memory.EarnPort,
	now func() time.Time,
) *memory.Service {
	t.Helper()
	adapters, err := ai.NewAdapters(ai.FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	service, err := memory.NewService(memory.ServiceDeps{
		Extractor:       adapters.Extractor,
		Embedder:        adapters.Embedder,
		Candidates:      store,
		Launches:        store,
		Universe:        store,
		Linker:          memory.NewLinkService(memory.LinkDeps{}),
		Progression:     progression,
		Recalls:         store,
		SpendGate:       spendGate,
		Earn:            earn,
		PredictionError: adapters.PredictionError,
		Gists:           store,
		ViewSemantics:   store,
		Signals:         store,
		Provenance:      store,
		Exports:         store,
		Diaries:         store,
		Releases:        releases,
		SealSuggester:   adapters.SealSuggester,
		Now:             now,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func waitForAdvisoryWaiter(t *testing.T, ctx context.Context, pool *platformdb.Pool, userID string) {
	t.Helper()
	for {
		select {
		case <-ctx.Done():
			t.Fatalf("transaction never blocked on graph advisory lock: %v", ctx.Err())
		default:
		}
		var waiting int
		if err := pool.PgxPool().QueryRow(ctx, `
			SELECT count(*) FROM pg_locks
			WHERE locktype = 'advisory'
			  AND mode = 'ExclusiveLock'
			  AND NOT granted
			  AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
			  AND classid::bigint = (hashtext('universe_state')::bigint & 4294967295)
			  AND objid::bigint = (hashtext($1)::bigint & 4294967295)
			  AND objsubid = 2
		`, userID).Scan(&waiting); err != nil {
			t.Fatalf("poll graph advisory waiter failed: %v", err)
		}
		if waiting > 0 {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func readSynapseStrength(t *testing.T, ctx context.Context, pool *platformdb.Pool, userID, synapseID string) float32 {
	t.Helper()
	var strength float32
	if err := pool.PgxPool().QueryRow(ctx,
		`SELECT strength FROM synapses WHERE user_id = $1 AND id = $2`, userID, synapseID,
	).Scan(&strength); err != nil {
		t.Fatalf("read synapse strength failed: %v", err)
	}
	return strength
}

func TestGraphMutationLockSerializesReleaseRecallAndConsolidation(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	now := day.AddDate(0, 0, 1)

	t.Run("release-before-recall", func(t *testing.T) {
		base := fmt.Sprintf("test-release-recall-a-%d", time.Now().UnixNano())
		userID := base + "-user-a"
		cleanupMemoryTestRows(t, pool, userID)
		scope, _ := platform.NewUserScope(userID)
		g := seedReleaseGraph(t, ctx, store, scope, base, day)
		otherUserID := base + "-user-b"
		cleanupMemoryTestRows(t, pool, otherUserID)
		otherScope, _ := platform.NewUserScope(otherUserID)
		otherGraph := seedReleaseGraph(t, ctx, store, otherScope, base+"-other", day)
		barrier := &graphBarrierReleaseRepo{
			ReleaseRepo: store,
			holdAt:      2,
			entered:     make(chan struct{}),
			proceed:     make(chan struct{}),
		}
		releaseService := newGraphConcurrencyService(t, store, barrier, memory.NoEarnOnWrite{}, func() time.Time { return now })
		recallService := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return now })
		otherService := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return now })
		releaseErr := make(chan error, 1)
		type recallOutcome struct {
			result memory.RecallDiaryStarsResult
			err    error
		}
		recallDone := make(chan recallOutcome, 1)

		go func() {
			_, err := releaseService.Release(ctx, scope, g.d1)
			releaseErr <- err
		}()
		select {
		case <-barrier.entered:
		case err := <-releaseErr:
			t.Fatalf("Release failed before barrier: %v", err)
		case <-ctx.Done():
			t.Fatalf("Release never reached body barrier: %v", ctx.Err())
		}

		go func() {
			result, err := recallService.RecallDiaryStars(ctx, scope, "op-a-diary-recall", g.d1, true)
			recallDone <- recallOutcome{result: result, err: err}
		}()
		waitForAdvisoryWaiter(t, ctx, pool, userID)

		beforeStrength := readSynapseStrength(t, ctx, pool, userID, g.syn)
		var beforeDeleted, beforeRecallCount int
		if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL`, userID).Scan(&beforeDeleted); err != nil {
			t.Fatalf("snapshot user A deleted memories failed: %v", err)
		}
		if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, g.m1).Scan(&beforeRecallCount); err != nil {
			t.Fatalf("snapshot user A recall count failed: %v", err)
		}

		otherCtx, otherCancel := context.WithTimeout(ctx, 5*time.Second)
		defer otherCancel()
		otherResult, err := otherService.RecallDiaryStars(otherCtx, otherScope, "op-b-diary-recall", otherGraph.d1, true)
		if err != nil {
			t.Fatalf("user B RecallDiaryStars blocked on user A graph lock: %v", err)
		}
		if len(otherResult.EpisodicMemoryIDs) != 1 || otherResult.EpisodicMemoryIDs[0] != otherGraph.m1 {
			t.Fatalf("user B recall result = %+v, want [%s]", otherResult, otherGraph.m1)
		}
		otherWant := float32(memory.Potentiate(float64(otherGraph.preSharedContribution), values.SynapsePotentiationRate))
		if got := readSynapseStrength(t, ctx, pool, otherUserID, otherGraph.syn); got != otherWant {
			t.Fatalf("user B recalled strength = %v, want %v", got, otherWant)
		}
		var otherRecallCount int
		if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, otherUserID, otherGraph.m1).Scan(&otherRecallCount); err != nil {
			t.Fatalf("read user B recall count failed: %v", err)
		}
		if otherRecallCount != 1 {
			t.Fatalf("user B recall count = %d, want 1", otherRecallCount)
		}
		if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != beforeStrength {
			t.Fatalf("user B mutation changed user A strength = %v, want snapshot %v", got, beforeStrength)
		}
		var afterDeleted, afterRecallCount int
		if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL`, userID).Scan(&afterDeleted); err != nil {
			t.Fatalf("read user A deleted memories after user B mutation failed: %v", err)
		}
		if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, g.m1).Scan(&afterRecallCount); err != nil {
			t.Fatalf("read user A recall count after user B mutation failed: %v", err)
		}
		if afterDeleted != beforeDeleted || afterRecallCount != beforeRecallCount {
			t.Fatalf("user B mutation changed user A snapshot = deleted %d recall %d, want %d/%d", afterDeleted, afterRecallCount, beforeDeleted, beforeRecallCount)
		}

		close(barrier.proceed)
		if err := <-releaseErr; err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		recall := <-recallDone
		// Serialized AFTER the release soft-deleted every memory of d1, the whole-diary recall finds
		// no live memory and correctly refuses (job 70) — so it reinforces nothing and the release's
		// Depress stands. (The refusal also blocks a free clock advance / cross-user receipt.)
		if !errors.Is(recall.err, memory.ErrRecallNoLiveMemories) {
			t.Fatalf("release→recall err = %v, want ErrRecallNoLiveMemories", recall.err)
		}
		if len(recall.result.EpisodicMemoryIDs) != 0 {
			t.Fatalf("release→recall affected memories = %v, want none after Release", recall.result.EpisodicMemoryIDs)
		}
		want := float32(memory.Depress(float64(g.preSharedContribution), values.DeletionContributionWeakenAmount))
		if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != want {
			t.Fatalf("release→recall strength = %v, want serial result %v", got, want)
		}
	})

	t.Run("recall-before-release", func(t *testing.T) {
		base := fmt.Sprintf("test-release-recall-b-%d", time.Now().UnixNano())
		userID := base + "-user"
		cleanupMemoryTestRows(t, pool, userID)
		scope, _ := platform.NewUserScope(userID)
		g := seedReleaseGraph(t, ctx, store, scope, base, day)
		barrier := &graphBarrierSpendGate{
			next:    memory.AllowAllSpendGate{},
			entered: make(chan struct{}),
			proceed: make(chan struct{}),
		}
		recallService := newGraphConcurrencyServiceWith(t, store, store, memory.NoopAdvanceProgression{}, barrier, memory.NoEarnOnWrite{}, func() time.Time { return now })
		releaseService := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return now })
		recallErr := make(chan error, 1)
		releaseErr := make(chan error, 1)

		go func() {
			_, err := recallService.RecallDiaryStars(ctx, scope, "op-a-diary-recall-2", g.d1, true)
			recallErr <- err
		}()
		select {
		case <-barrier.entered:
		case err := <-recallErr:
			t.Fatalf("RecallDiaryStars failed before SpendGate barrier: %v", err)
		case <-ctx.Done():
			t.Fatalf("RecallDiaryStars never reached SpendGate barrier: %v", ctx.Err())
		}
		go func() {
			_, err := releaseService.Release(ctx, scope, g.d1)
			releaseErr <- err
		}()
		waitForAdvisoryWaiter(t, ctx, pool, userID)
		close(barrier.proceed)
		if err := <-recallErr; err != nil {
			t.Fatalf("RecallDiaryStars failed: %v", err)
		}
		if err := <-releaseErr; err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		potentiated := float32(memory.Potentiate(float64(g.preSharedContribution), values.SynapsePotentiationRate))
		want := float32(memory.Depress(float64(potentiated), values.DeletionContributionWeakenAmount))
		if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != want {
			t.Fatalf("recall→release strength = %v, want serial result %v", got, want)
		}
		var recallCount int
		if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, g.m1).Scan(&recallCount); err != nil {
			t.Fatalf("read recalled memory count failed: %v", err)
		}
		if recallCount != 1 {
			t.Fatalf("recall→release recall count = %d, want 1", recallCount)
		}
	})

	t.Run("consolidation-before-release", func(t *testing.T) {
		base := fmt.Sprintf("test-release-consolidate-%d", time.Now().UnixNano())
		userID := base + "-user"
		cleanupMemoryTestRows(t, pool, userID)
		scope, _ := platform.NewUserScope(userID)
		g := seedReleaseGraph(t, ctx, store, scope, base, day)
		if _, err := store.AdvanceUniverseClock(ctx, scope, day); err != nil {
			t.Fatalf("seed universe clock failed: %v", err)
		}
		barrier := &graphBarrierProgression{
			next:    memory.NewConsolidator(nil),
			entered: make(chan struct{}),
			proceed: make(chan struct{}),
		}
		consolidateService := newGraphConcurrencyServiceWith(t, store, store, barrier, memory.AllowAllSpendGate{}, memory.NoEarnOnWrite{}, func() time.Time { return now })
		releaseService := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return now })
		consolidateErr := make(chan error, 1)
		releaseErr := make(chan error, 1)

		go func() {
			_, err := consolidateService.SyncToToday(ctx, scope)
			consolidateErr <- err
		}()
		select {
		case <-barrier.entered:
		case err := <-consolidateErr:
			t.Fatalf("SyncToToday failed before Consolidator barrier: %v", err)
		case <-ctx.Done():
			t.Fatalf("SyncToToday never reached Consolidator barrier: %v", ctx.Err())
		}
		go func() {
			_, err := releaseService.Release(ctx, scope, g.d1)
			releaseErr <- err
		}()
		waitForAdvisoryWaiter(t, ctx, pool, userID)
		close(barrier.proceed)
		if err := <-consolidateErr; err != nil {
			t.Fatalf("SyncToToday with Consolidator failed: %v", err)
		}
		if err := <-releaseErr; err != nil {
			t.Fatalf("Release failed: %v", err)
		}
		downscaled := float32(memory.Downscale(float64(g.preSharedContribution), values.ConsolidationDownscaleFactor))
		want := float32(memory.Depress(float64(downscaled), values.DeletionContributionWeakenAmount))
		if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != want {
			t.Fatalf("consolidation→release strength = %v, want serial result %v", got, want)
		}
	})
}

func TestConcurrentLaunchBeforeReleasePreservesSharedNeuron(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	base := fmt.Sprintf("test-release-launch-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	day := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	emotion, _ := memory.NewEmotion(memory.MoodCalm)
	diaryID := base + "-old-diary"
	memoryID := base + "-old-memory"
	neuronID := base + "-shared-neuron"
	if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: diaryID, Body: "old", DiaryDate: day, CreatedAt: day}); err != nil {
		t.Fatalf("seed old diary failed: %v", err)
	}
	seed := int64(1)
	if _, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: memoryID, DiaryID: diaryID, Name: "old", CurrentText: "old", Seed: &seed,
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	}); err != nil {
		t.Fatalf("seed old memory failed: %v", err)
	}
	sharedName := "shared"
	if _, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID: neuronID, Name: &sharedName, Type: memory.NeuronTypeSemantic, CreatedAt: day,
	}); err != nil {
		t.Fatalf("seed shared neuron failed: %v", err)
	}
	if _, err := store.InsertNeuronActivation(ctx, scope, memory.NeuronActivation{
		EpisodicMemoryID: memoryID, NeuronID: neuronID, Weight: 1,
	}); err != nil {
		t.Fatalf("seed old activation failed: %v", err)
	}

	entered := make(chan struct{})
	proceed := make(chan struct{})
	now := func() time.Time { return day.AddDate(0, 0, 1) }
	launchService := newGraphConcurrencyService(t, store, store, graphBarrierEarn{entered: entered, proceed: proceed}, now)
	releaseService := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, now)
	launchErr := make(chan error, 1)
	releaseErr := make(chan error, 1)
	go func() {
		_, err := launchService.PersistEncoded(ctx, scope, "new diary", day.AddDate(0, 0, 1), []memory.ExtractedMemory{
			{
				Name: "new one", Mood: memory.MoodCalm,
				Neurons: []memory.ExtractedNeuron{{Name: "shared", Type: memory.NeuronTypeSemantic}},
			},
			{
				Name: "new two", Mood: memory.MoodJoy,
				Neurons: []memory.ExtractedNeuron{{Name: "shared", Type: memory.NeuronTypeSemantic}},
			},
		})
		launchErr <- err
	}()
	select {
	case <-entered:
	case err := <-launchErr:
		t.Fatalf("launch failed before barrier: %v", err)
	case <-ctx.Done():
		t.Fatalf("launch never reached barrier: %v", ctx.Err())
	}
	go func() {
		_, err := releaseService.Release(ctx, scope, diaryID)
		releaseErr <- err
	}()
	waitForAdvisoryWaiter(t, ctx, pool, userID)
	close(proceed)
	if err := <-launchErr; err != nil {
		t.Fatalf("launch failed: %v", err)
	}
	if err := <-releaseErr; err != nil {
		t.Fatalf("release failed: %v", err)
	}

	var liveOwners, sealed int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT count(*)
		FROM neuron_activations AS na
		JOIN episodic_memories AS em ON em.id = na.episodic_memory_id AND em.user_id = na.user_id
		WHERE na.user_id = $1 AND na.neuron_id = $2 AND em.deleted_at IS NULL
	`, userID, neuronID).Scan(&liveOwners); err != nil {
		t.Fatalf("count live shared owners failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM neurons WHERE user_id = $1 AND id = $2 AND sealed_at IS NOT NULL`, userID, neuronID).Scan(&sealed); err != nil {
		t.Fatalf("inspect shared seal failed: %v", err)
	}
	if liveOwners != 2 || sealed != 0 {
		t.Fatalf("release-vs-launch graph = live owners %d sealed %d, want 2/0", liveOwners, sealed)
	}
}

func TestConcurrentOverlappingReleasesMatchSerialExecution(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	base := fmt.Sprintf("test-concurrent-overlap-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedOverlappingReleaseGraph(t, ctx, store, scope, base, day)
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	barrier := &graphBarrierReleaseRepo{
		ReleaseRepo: store,
		holdAt:      2, // Release A's opportunistic Sweep is lock 1; its body is lock 2.
		entered:     make(chan struct{}),
		proceed:     make(chan struct{}),
	}
	serviceA := newGraphConcurrencyService(t, store, barrier, memory.NoEarnOnWrite{}, func() time.Time { return releaseAt })
	serviceB := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return releaseAt })
	errA := make(chan error, 1)
	errB := make(chan error, 1)
	go func() {
		_, err := serviceA.Release(ctx, scope, g.d1)
		errA <- err
	}()
	select {
	case <-barrier.entered:
	case err := <-errA:
		t.Fatalf("Release A failed before barrier: %v", err)
	case <-ctx.Done():
		t.Fatalf("Release A never reached body barrier: %v", ctx.Err())
	}
	go func() {
		_, err := serviceB.Release(ctx, scope, g.d2)
		errB <- err
	}()
	waitForAdvisoryWaiter(t, ctx, pool, userID)
	close(barrier.proceed)
	if err := <-errA; err != nil {
		t.Fatalf("Release A failed: %v", err)
	}
	if err := <-errB; err != nil {
		t.Fatalf("Release B failed: %v", err)
	}

	var groups, deletedMemories, sealed, liveSealed int
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM release_groups WHERE user_id = $1`, userID).Scan(&groups); err != nil {
		t.Fatalf("count concurrent release groups failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL`, userID).Scan(&deletedMemories); err != nil {
		t.Fatalf("count concurrent deleted memories failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM neurons WHERE user_id = $1 AND sealed_at IS NOT NULL`, userID).Scan(&sealed); err != nil {
		t.Fatalf("count concurrent sealed neurons failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT count(*)
		FROM neuron_activations AS na
		JOIN episodic_memories AS em ON em.id = na.episodic_memory_id AND em.user_id = na.user_id
		JOIN neurons AS n ON n.id = na.neuron_id AND n.user_id = na.user_id
		WHERE na.user_id = $1 AND em.deleted_at IS NULL AND n.sealed_at IS NOT NULL
	`, userID).Scan(&liveSealed); err != nil {
		t.Fatalf("count concurrent live-sealed activations failed: %v", err)
	}
	firstStrength := float32(memory.Depress(float64(g.preSharedContribution), values.DeletionContributionWeakenAmount))
	wantStrength := float32(memory.Depress(float64(firstStrength), values.DeletionContributionWeakenAmount))
	if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != wantStrength {
		t.Fatalf("overlapping Release LTD strength = %v, want two serial Depress steps %v", got, wantStrength)
	}
	rows, err := pool.PgxPool().Query(ctx, `
		SELECT d.applied_delta
		FROM release_synapse_deltas AS d
		JOIN release_groups AS g ON g.id = d.release_id AND g.user_id = d.user_id
		WHERE d.user_id = $1 AND d.synapse_id = $2
		ORDER BY g.diary_id
	`, userID, g.syn)
	if err != nil {
		t.Fatalf("read overlapping release deltas failed: %v", err)
	}
	defer rows.Close()
	deltas := make([]float32, 0, 2)
	for rows.Next() {
		var delta float32
		if err := rows.Scan(&delta); err != nil {
			t.Fatalf("scan overlapping release delta failed: %v", err)
		}
		deltas = append(deltas, delta)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate overlapping release deltas failed: %v", err)
	}
	wantDeltas := []float32{g.preSharedContribution - firstStrength, firstStrength - wantStrength}
	if len(deltas) != len(wantDeltas) || deltas[0] != wantDeltas[0] || deltas[1] != wantDeltas[1] {
		t.Fatalf("overlapping release deltas = %v, want actual serial deltas %v", deltas, wantDeltas)
	}
	if groups != 2 || deletedMemories != 2 || sealed != 0 || liveSealed != 0 {
		t.Fatalf("concurrent overlap = groups %d deleted %d sealed %d live-sealed %d, want 2/2/0/0", groups, deletedMemories, sealed, liveSealed)
	}
}

func TestConcurrentReleaseAndRestoreMatchBothSerialOrders(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	raceAt := releaseAt.Add(time.Hour)

	for _, releaseFirst := range []bool{true, false} {
		releaseFirst := releaseFirst
		t.Run(fmt.Sprintf("release-first-%v", releaseFirst), func(t *testing.T) {
			base := fmt.Sprintf("test-release-restore-%v-%d", releaseFirst, time.Now().UnixNano())
			userID := base + "-user"
			cleanupMemoryTestRows(t, pool, userID)
			scope, _ := platform.NewUserScope(userID)
			g := seedReleaseGraph(t, ctx, store, scope, base, day)
			if _, err := newGraphConcurrencyService(t, store, store, memory.NoEarnOnWrite{}, func() time.Time { return releaseAt }).Release(ctx, scope, g.d1); err != nil {
				t.Fatalf("seed Release failed: %v", err)
			}

			barrier := &graphBarrierReleaseRepo{
				ReleaseRepo: store,
				holdAt:      1,
				entered:     make(chan struct{}),
				proceed:     make(chan struct{}),
			}
			if releaseFirst {
				barrier.holdAt = 2 // The stale Release's opportunistic Sweep takes lock 1.
			}
			releaseRepo := memory.ReleaseRepo(store)
			restoreRepo := memory.ReleaseRepo(store)
			if releaseFirst {
				releaseRepo = barrier
			} else {
				restoreRepo = barrier
			}
			releaseService := newGraphConcurrencyService(t, store, releaseRepo, memory.NoEarnOnWrite{}, func() time.Time { return raceAt })
			restoreService := newGraphConcurrencyService(t, store, restoreRepo, memory.NoEarnOnWrite{}, func() time.Time { return raceAt })
			releaseErr := make(chan error, 1)
			restoreErr := make(chan error, 1)
			startRelease := func() {
				go func() {
					_, err := releaseService.Release(ctx, scope, g.d1)
					releaseErr <- err
				}()
			}
			startRestore := func() {
				go func() {
					_, err := restoreService.Restore(ctx, scope, g.d1)
					restoreErr <- err
				}()
			}
			if releaseFirst {
				startRelease()
			} else {
				startRestore()
			}
			select {
			case <-barrier.entered:
			case <-ctx.Done():
				t.Fatalf("first Release/Restore never reached graph barrier: %v", ctx.Err())
			}
			if releaseFirst {
				startRestore()
			} else {
				startRelease()
			}
			waitForAdvisoryWaiter(t, ctx, pool, userID)
			close(barrier.proceed)
			releaseFailure := <-releaseErr
			restoreFailure := <-restoreErr

			if releaseFirst {
				if !errors.Is(releaseFailure, memory.ErrAlreadyReleased) {
					t.Fatalf("Release→Restore stale Release err = %v, want ErrAlreadyReleased", releaseFailure)
				}
				if restoreFailure != nil {
					t.Fatalf("Release→Restore Restore failed: %v", restoreFailure)
				}
			} else if restoreFailure != nil || releaseFailure != nil {
				t.Fatalf("Restore→Release errors = restore %v release %v, want nil/nil", restoreFailure, releaseFailure)
			}

			var groups, deletedMemories, liveSealed int
			if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM release_groups WHERE user_id = $1`, userID).Scan(&groups); err != nil {
				t.Fatalf("count release-vs-restore groups failed: %v", err)
			}
			if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL`, userID).Scan(&deletedMemories); err != nil {
				t.Fatalf("count release-vs-restore deleted memories failed: %v", err)
			}
			if err := pool.PgxPool().QueryRow(ctx, `
				SELECT count(*)
				FROM neuron_activations AS na
				JOIN episodic_memories AS em ON em.id = na.episodic_memory_id AND em.user_id = na.user_id
				JOIN neurons AS n ON n.id = na.neuron_id AND n.user_id = na.user_id
				WHERE na.user_id = $1 AND em.deleted_at IS NULL AND n.sealed_at IS NOT NULL
			`, userID).Scan(&liveSealed); err != nil {
				t.Fatalf("count release-vs-restore live-sealed activations failed: %v", err)
			}
			wantGroups, wantDeleted := 1, 1
			wantStrength := float32(memory.Depress(float64(g.preSharedContribution), values.DeletionContributionWeakenAmount))
			if releaseFirst {
				wantGroups, wantDeleted = 0, 0
				wantStrength = g.preSharedContribution
			}
			if got := readSynapseStrength(t, ctx, pool, userID, g.syn); got != wantStrength {
				t.Fatalf("release-vs-restore strength = %v, want serial result %v", got, wantStrength)
			}
			if groups != wantGroups || deletedMemories != wantDeleted || liveSealed != 0 {
				t.Fatalf("release-vs-restore graph = groups %d deleted %d live-sealed %d, want %d/%d/0", groups, deletedMemories, liveSealed, wantGroups, wantDeleted)
			}
		})
	}
}

func TestConcurrentRestoreAndBoundarySweepConverge(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	deadline := releaseAt.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour)

	for _, sweepFirst := range []bool{false, true} {
		sweepFirst := sweepFirst
		t.Run(fmt.Sprintf("sweep-first-%v", sweepFirst), func(t *testing.T) {
			base := fmt.Sprintf("test-restore-sweep-%v-%d", sweepFirst, time.Now().UnixNano())
			userID := base + "-user"
			cleanupMemoryTestRows(t, pool, userID)
			scope, _ := platform.NewUserScope(userID)
			g := seedReleaseGraph(t, ctx, store, scope, base, day)
			if _, err := newReleaseService(t, store, func() time.Time { return releaseAt }).Release(ctx, scope, g.d1); err != nil {
				t.Fatalf("seed Release failed: %v", err)
			}
			var releaseID string
			if err := pool.PgxPool().QueryRow(ctx, `SELECT id FROM release_groups WHERE user_id = $1 AND diary_id = $2`, userID, g.d1).Scan(&releaseID); err != nil {
				t.Fatalf("read release group failed: %v", err)
			}

			barrier := &graphBarrierReleaseRepo{
				ReleaseRepo: store,
				holdAt:      1,
				entered:     make(chan struct{}),
				proceed:     make(chan struct{}),
			}
			restoreErr := make(chan error, 1)
			sweepResult := make(chan struct {
				swept bool
				err   error
			}, 1)
			startRestore := func(repo memory.ReleaseRepo) {
				service := newGraphConcurrencyService(t, store, repo, memory.NoEarnOnWrite{}, func() time.Time { return deadline })
				go func() {
					_, err := service.Restore(ctx, scope, g.d1)
					restoreErr <- err
				}()
			}
			startSweep := func(repo memory.ReleaseRepo) {
				go func() {
					swept, err := memory.NewRetentionSweeper(repo).SweepRelease(ctx, scope, releaseID, deadline)
					sweepResult <- struct {
						swept bool
						err   error
					}{swept: swept, err: err}
				}()
			}

			if sweepFirst {
				startSweep(barrier)
			} else {
				startRestore(barrier)
			}
			select {
			case <-barrier.entered:
			case <-ctx.Done():
				t.Fatalf("first boundary mutation never reached barrier: %v", ctx.Err())
			}
			if sweepFirst {
				startRestore(store)
			} else {
				startSweep(store)
			}
			waitForAdvisoryWaiter(t, ctx, pool, userID)
			close(barrier.proceed)
			restoreFailure := <-restoreErr
			sweep := <-sweepResult
			if sweep.err != nil || !sweep.swept {
				t.Fatalf("boundary Sweep = (%v, %v), want true/nil", sweep.swept, sweep.err)
			}
			if sweepFirst && !errors.Is(restoreFailure, memory.ErrRestoreNotReleased) {
				t.Fatalf("restore after Sweep err = %v, want ErrRestoreNotReleased", restoreFailure)
			}
			if !sweepFirst && !errors.Is(restoreFailure, memory.ErrRestoreWindowExpired) {
				t.Fatalf("restore at deadline err = %v, want ErrRestoreWindowExpired", restoreFailure)
			}
			var memories int
			if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1`, userID).Scan(&memories); err != nil {
				t.Fatalf("count boundary memories failed: %v", err)
			}
			if memories != 1 { // d2/m2 remains; d1/m1 was swept.
				t.Fatalf("boundary final memories = %d, want the outside memory only", memories)
			}
		})
	}
}
