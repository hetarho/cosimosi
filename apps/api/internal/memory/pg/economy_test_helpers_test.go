package pg

import (
	"testing"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

// withEconomy binds an EconomyTx onto every transaction the store opens. Suites that exercise the
// graph without Twinkle or achievements bind memory.NoEconomy; a suite that must hold a transaction
// inside its spend or earn binds a barrier.
func withEconomy(store Store, economy memory.EconomyTx) Store {
	return store.WithEconomyBinding(func(dbgen.DBTX) memory.EconomyTx { return economy })
}

// graphServices is the pg suites' set of memory services over one store, so a test drives launch,
// paid actions, release and reads against the same database state.
type graphServices struct {
	*memory.EncodingService
	*memory.LaunchService
	*memory.PaidActionService
	*memory.ReleaseService
	*memory.ReadService
}

type graphServiceDeps struct {
	store       Store
	releases    memory.ReleaseRepo
	progression memory.AdvanceProgression
	now         func() time.Time
	newSeed     func() int64
}

func newGraphServices(t *testing.T, deps graphServiceDeps) *graphServices {
	t.Helper()
	adapters, err := ai.NewAdapters(ai.FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	store := deps.store
	releases := deps.releases
	if releases == nil {
		releases = store
	}
	progression := deps.progression
	if progression == nil {
		progression = memory.NoopAdvanceProgression{}
	}
	services := &graphServices{}
	fail := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatalf("memory service construction failed: %v", err)
		}
	}
	services.EncodingService, err = memory.NewEncodingService(memory.EncodingDeps{
		Extractor: adapters.Extractor, Embedder: adapters.Embedder, Candidates: store,
	})
	fail(err)
	services.LaunchService, err = memory.NewLaunchService(memory.LaunchDeps{
		Launches:         store,
		Linker:           memory.NewLinkService(memory.LinkDeps{}),
		Progression:      progression,
		SignupSettlement: memory.NoSignupSettlement{},
		UserZone:         memory.UTCUserZone{},
		Now:              deps.now,
		NewSeed:          deps.newSeed,
	})
	fail(err)
	services.PaidActionService, err = memory.NewPaidActionService(memory.PaidActionDeps{
		Recalls:         store,
		ViewSemantics:   store,
		PredictionError: adapters.PredictionError,
		Progression:     progression,
		UserZone:        memory.UTCUserZone{},
		Now:             deps.now,
		NewSeed:         deps.newSeed,
	})
	fail(err)
	services.ReleaseService, err = memory.NewReleaseService(memory.ReleaseDeps{
		Releases: releases, SealSuggester: adapters.SealSuggester, Now: deps.now,
	})
	fail(err)
	services.ReadService, err = memory.NewReadService(memory.ReadDeps{
		Universe: store, Provenance: store, Diaries: store, Clock: store, UserZone: memory.UTCUserZone{}, Now: deps.now,
	})
	fail(err)
	return services
}

func mustRetentionSweeper(t *testing.T, repo memory.ReleaseRepo) memory.RetentionSweeper {
	t.Helper()
	sweeper, err := memory.NewRetentionSweeper(repo)
	if err != nil {
		t.Fatalf("NewRetentionSweeper failed: %v", err)
	}
	return sweeper
}

// newTestJobRunner runs memory's registered jobs over queue the way the roots compose them.
func newTestJobRunner(t *testing.T, queue *recordingJobQueue, store Store, now func() time.Time, maxClaims int32) jobqueue.Runner[jobqueue.Record] {
	t.Helper()
	registrations, err := memory.JobRegistrations(memory.JobDeps{
		Embedder:             ai.NewMockEmbedder(),
		Semanticizer:         ai.NewMockSemanticizer(),
		Sources:              store,
		EmbeddingWriter:      store,
		SemanticStagesWriter: store,
		Releases:             store,
		Now:                  now,
	})
	if err != nil {
		t.Fatalf("JobRegistrations failed: %v", err)
	}
	runner, err := jobqueue.NewRunner[jobqueue.Record](queue, registrations, jobqueue.Config{
		Lease:        testJobLease,
		MaxAttempts:  int32(values.AiJobMaxAttempts),
		MaxClaims:    maxClaims,
		BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
		PollInterval: time.Millisecond,
		Now:          now,
	})
	if err != nil {
		t.Fatalf("NewRunner failed: %v", err)
	}
	return runner
}
