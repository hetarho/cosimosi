// Command api is the cosimosi HTTP/RPC API server.
//
// This file is the composition root: the only place that wires configuration,
// infrastructure clients, and the server together. Every other package depends
// inward. The Connect server itself (mux, h2c, CORS, interceptors, /health) is
// assembled in internal/platform/rpcserver.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	sentry "github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"

	"github.com/cosimosi/backend/internal/admin"
	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/gift"
	"github.com/cosimosi/backend/internal/invite"
	"github.com/cosimosi/backend/internal/job"
	"github.com/cosimosi/backend/internal/link"
	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/memory"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
	"github.com/cosimosi/backend/internal/settings"
	"github.com/cosimosi/backend/internal/share"
)

const version = "0.0.1"

// segmenterAdapter maps the ai extraction result onto memory's consumer-side
// Extractor port (SegmentMemory preview). It lives in the composition root so
// memory never imports ai — the ai test suite imports memory for the body-cap
// mirror guard, and an ai import in memory would be an import cycle.
type segmenterAdapter struct {
	inner ai.Extractor
}

func (a segmenterAdapter) Extract(ctx context.Context, body string) ([]memory.SegmentInput, error) {
	ext, err := a.inner.Extract(ctx, body)
	if err != nil {
		return nil, err
	}
	out := make([]memory.SegmentInput, 0, len(ext.Segments))
	for _, s := range ext.Segments {
		out = append(out, memory.SegmentInput{
			Text:      s.Text,
			Mood:      memory.Mood(s.Mood),
			Intensity: s.Intensity,
			Valence:   s.Valence,
		})
	}
	return out, nil
}

// shareSettingsAdapter maps settings.Service onto share's SettingsReader port (spec 35): the
// public snapshot includes the owner's spec-30 visual settings, but internal/share must not
// import internal/settings — so the composition root adapts it here (the segmenterAdapter
// precedent above).
type shareSettingsAdapter struct {
	inner *settings.Service
}

func (a shareSettingsAdapter) Appearance(ctx context.Context, userID string) (share.Appearance, error) {
	s, err := a.inner.Get(ctx, userID)
	if err != nil {
		return share.Appearance{}, err
	}
	colors := make([]share.EmotionColor, 0, len(s.EmotionColors))
	for _, c := range s.EmotionColors {
		colors = append(colors, share.EmotionColor{Mood: c.Mood, Color: c.Color})
	}
	return share.Appearance{
		Theme:         s.Theme,
		StarObject:    s.StarObject,
		SelfObject:    s.SelfObject,
		SynapseStyle:  s.SynapseStyle,
		EmotionColors: colors,
	}, nil
}

// giftShareAdapter maps share.Service onto gift's ShareReader port (spec 36): a gift's
// sender/partner display name + visit slug come from the spec-35 universe_shares row, but
// internal/gift must not import internal/share — so the composition root adapts GetSettings
// here (the shareSettingsAdapter precedent). A never-shared user → name "" + enabled=false.
type giftShareAdapter struct {
	inner *share.Service
}

func (a giftShareAdapter) DisplayInfo(ctx context.Context, userID string) (string, string, bool, error) {
	st, err := a.inner.GetSettings(ctx, userID)
	if err != nil {
		return "", "", false, err
	}
	return st.DisplayName, st.Slug, st.Enabled, nil
}

// shareResonanceAdapter maps gift.Service onto share's ResonanceReader port (spec 37): the
// overlay's resonance bridges come from spec-36 resonances, but internal/share must not import
// internal/gift (and gift already depends on share via giftShareAdapter — a direct import either
// way is a cycle). So the composition root adapts gift here. It's a POINTER with a settable
// `inner` because the two services form a wiring cycle (share needs gift's resonances; gift needs
// share's display names): share is built first with this adapter, then gift, then inner is bound.
// The method is only ever called at request time (long after wiring), so inner is set by then.
type shareResonanceAdapter struct {
	inner *gift.Service
}

func (a *shareResonanceAdapter) ResonancesBetween(ctx context.Context, callerUserID, ownerUserID string) ([]share.ResonancePair, error) {
	pairs, err := a.inner.ResonancesBetween(ctx, callerUserID, ownerUserID)
	if err != nil {
		return nil, err
	}
	out := make([]share.ResonancePair, len(pairs))
	for i, p := range pairs {
		out[i] = share.ResonancePair{MyMemoryID: p.MyMemoryID, TheirMemoryID: p.TheirMemoryID}
	}
	return out, nil
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	// Production error tracking. No DSN → skipped entirely, so local/dev
	// and tests are unaffected. Handler panics are captured by the sentryhttp wrap below.
	sentryEnabled := false
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:         cfg.SentryDSN,
			Environment: cfg.SentryEnvironment,
			Release:     version,
		}); err != nil {
			slog.Warn("sentry init failed; continuing without it", "err", err)
		} else {
			sentryEnabled = true
			defer sentry.Flush(2 * time.Second)
			defer sentry.Recover()
			slog.Info("sentry enabled", "environment", cfg.SentryEnvironment)
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := postgres.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("postgres init failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	// Admin console (spec 34): LLM provider/key management + ops dashboard.
	// A nil cipher (LLM_KEY_ENCRYPTION_KEY unset) is a valid degraded state —
	// reads work, key writes return FailedPrecondition; an INVALID key is a
	// boot error (a typo silently disabling encryption would be worse).
	adminCipher, err := admin.NewCipher(cfg.LLMKeyEncryptionKey)
	if err != nil {
		slog.Error("admin cipher init failed", "err", err)
		os.Exit(1)
	}
	adminSvc := admin.NewService(admin.NewRepository(db), adminCipher, cfg)
	adminHandler := admin.NewHandler(adminSvc)

	embedder, err := ai.NewEmbedder(cfg)
	if err != nil {
		slog.Error("embedder init failed", "err", err)
		os.Exit(1)
	}
	// The extractor's llm client is the admin-backed resolver (spec 34): the
	// active provider/model/key swap at runtime without a restart. adminSvc also
	// serves as the ConfigSource the extractor follows — an ACTIVE console
	// selection routes extraction to the real LLM, none degrades to the keyless
	// mock (turning AI on/off is a console action, not an env change).
	// Shared by the worker (async extract jobs) AND the memory service
	// (synchronous SegmentMemory preview).
	extractor := ai.NewExtractor(cfg, llm.NewResolver(adminSvc, cfg, adminSvc), adminSvc)

	// Compose the feature graph: link read service feeds the memory service's
	// GetUniverse; the memory handler is the real MemoryService implementation
	// mounted by rpcserver. The extractor reaches memory through the
	// segmenterAdapter (memory's consumer port — memory must not import ai).
	linkSvc := link.NewService(link.NewRepository(db))
	memorySvc := memory.NewService(memory.NewRepository(db), linkSvc, segmenterAdapter{inner: extractor})
	memoryHandler := memory.NewHandler(memorySvc)
	settingsSvc := settings.NewService(settings.NewRepository(db))
	settingsHandler := settings.NewHandler(settingsSvc)

	// Universe sharing (spec 35): owner ShareService + public VisitService, one Handler. The
	// public snapshot folds in the owner's spec-30 appearance, so share follows settings through
	// shareSettingsAdapter (settings.Service → share.SettingsReader) — share never imports settings.
	// The spec-37 overlay's resonance bridges come from gift via shareResonanceAdapter, bound below
	// once gift exists (the two services form a wiring cycle).
	resonanceAdapter := &shareResonanceAdapter{}
	shareSvc := share.NewService(share.NewRepository(db), shareSettingsAdapter{inner: settingsSvc}, resonanceAdapter)
	shareHandler := share.NewHandler(shareSvc)

	// Shared-memory resonance (spec 36): send a star → friend accepts by rewriting → a new star
	// is born in the friend's universe + the two are linked by a resonance. The gift service
	// reuses the spec-35 display name (giftShareAdapter: share.Service → gift.ShareReader) so it
	// never imports share. GiftService is fully authenticated (both parties are users).
	giftSvc := gift.NewService(gift.NewRepository(db), giftShareAdapter{inner: shareSvc})
	resonanceAdapter.inner = giftSvc // close the share↔gift cycle (spec 37 overlay bridges)
	giftHandler := gift.NewHandler(giftSvc)

	// Invite membership gate (spec 41): a removable closed-beta gate on top of auth. The repo is
	// both the InviteService/InviteAdminService backend AND the MembershipChecker the rpcserver
	// membership interceptor consults. The one Handler implements both invite services (the
	// spec-35 share Handler precedent); cfg.InviteGateEnabled makes the gate transparent when off.
	inviteRepo := invite.NewRepository(db)
	inviteSvc := invite.NewService(inviteRepo, cfg.InviteGateEnabled)
	inviteHandler := invite.NewHandler(inviteSvc, cfg.AdminUserIDs)

	// Async extraction + embedding worker (specs 05/21): consumes the extract job
	// the RecordMemory transaction enqueues, fans the diary out into fragment
	// stars, then embeds each fragment and writes initial semantic synapses.
	// It runs as a goroutine in this process and shares the
	// signal-cancelled ctx so it stops on shutdown.
	worker := job.NewWorker(job.NewRepository(db), job.NewGraphStore(db), embedder, extractor, slog.Default())
	workerDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(workerDone)
	}()

	// Nightly consolidation ticker (spec 27): once a day it enqueues a consolidate job
	// per active user; the worker goroutine above claims/runs them. In this single-binary
	// MVP deploy the worker runs here (Architecture §4.6), so the ticker lives here too —
	// without it the nightly pass would never fire (cmd/worker isn't deployed). Shares the
	// signal-cancelled ctx; enqueue is idempotent so a co-running cmd/worker can't duplicate.
	tickerDone := make(chan struct{})
	go func() {
		job.StartNightlyConsolidation(ctx, job.NewScheduler(db), slog.Default())
		close(tickerDone)
	}()

	// RPC panics are recovered INSIDE connect (rpcserver recover handler, 17) and
	// no longer propagate to the sentryhttp wrap below — this hook is how they
	// still reach Sentry. Keeps Sentry in the composition root (rpcserver stays
	// infra-only; nil hook = log-only).
	var panicCapture rpcserver.PanicCapture
	if sentryEnabled {
		panicCapture = func(ctx context.Context, _ string, p any) {
			hub := sentry.GetHubFromContext(ctx) // request-scoped hub from the sentryhttp wrap
			if hub == nil {
				hub = sentry.CurrentHub()
			}
			hub.RecoverWithContext(ctx, p)
		}
	}
	// The one share.Handler implements both services — auth is enforced by the chain each is
	// mounted with (rpcserver), so the SAME handler is passed for the owner (ShareService) and
	// public (VisitService) surfaces.
	server := rpcserver.New(cfg, db, version, memoryHandler, settingsHandler, adminHandler, shareHandler, shareHandler, giftHandler, inviteHandler, inviteHandler, inviteRepo, panicCapture)

	// The sentryhttp wrap still earns its keep after 17: it attaches the
	// request-scoped hub the capture hook reads, and catches panics from non-RPC
	// mux handlers (/health). Repanic so net/http still returns 500 on those.
	if sentryEnabled {
		server.Handler = sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle(server.Handler)
	}

	// A serve error (e.g. the port is already bound) must NOT exit 0 — an
	// orchestrator would read a clean exit as success and never restart us.
	// Surface it on a channel so the startup path can exit non-zero.
	serveErr := make(chan error, 1)
	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
	}()

	select {
	case <-ctx.Done():
		slog.Info("shutting down")
	case err := <-serveErr:
		slog.Error("listen failed", "err", err)
		os.Exit(1)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown failed", "err", err)
	}

	// Wait for the worker goroutine to observe the cancelled ctx and stop before
	// the deferred db.Close() runs, so it never closes the pool out from under an
	// in-flight job. Run returns promptly (its DB calls fail fast on the cancelled
	// ctx); a bounded wait guards against a stuck call, with the ClaimJob lease as
	// the safety net for any job left mid-flight.
	select {
	case <-workerDone:
	case <-time.After(5 * time.Second):
		slog.Warn("worker did not stop in time; proceeding to shutdown")
	}
	// The ticker observes the same cancelled ctx and returns promptly (it's idle between
	// daily wake-ups, or its enqueue calls fail fast on the cancelled ctx). Bounded wait so
	// db.Close() never runs out from under an in-flight enqueue.
	select {
	case <-tickerDone:
	case <-time.After(2 * time.Second):
		slog.Warn("nightly ticker did not stop in time; proceeding to shutdown")
	}
}
