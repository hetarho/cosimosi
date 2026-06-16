package job

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/cosimosi/backend/internal/values"
)

// Nightly consolidation — "the universe's sleep" (spec 27). Once a night the ticker
// enqueues one consolidate job per active user; the worker runs four ordered passes
// over that user's whole graph, then leaves cluster excitability (spec 22) to its
// natural time-decay so the next day's competitive allocation starts fresh (the 24h
// engram-rotation cycle). NOTHING is deleted: stars/synapses are never row-removed
// (constitution §2) and the original records are never touched (constitution §1).
//
//  ① re-stabilize : full force-sim re-layout (pin policy released at night), cached
//  ② redistribute : pull each star toward its host-cluster centroid (+schema bonus)
//  ③ gist         : oldest, least-recalled stars' form simplifies one step (append-only history)
//  ④ prune        : weak, long-idle synapses dim to a floor (weight only — kept, clickable)
//  ⑤ excitability : reset — no-op (derived from timestamps, τ=6h; see note at the call site)

// 4-pass consolidation tuning — single source is spec/values.yaml (consolidation:), generated
// into the values package. gistDedupeWindow stays here (a Duration, not a balance knob).
const (
	redistributeLerp     = values.ConsolidationRedistributeLerp     // ② host-cluster centroid pull
	schemaBonus          = values.ConsolidationSchemaBonus          // ② extra pull for schema-fit stars
	schemaMinCluster     = values.ConsolidationSchemaMinCluster     // ② recurring-"schema" min cluster size
	schemaMinDegree      = values.ConsolidationSchemaMinDegree      // ② "well-connected": ≥2 incident synapses
	gistAgeDays          = values.ConsolidationGistAgeDays          // ③ older than this AND…
	gistRecallCutoffDays = values.ConsolidationGistRecallCutoffDays // ③ …un-recalled since this → gist candidate
	gistFormSimplify     = values.ConsolidationGistFormSimplify     // ③ monotonic form_seed_delta increase
	weakEdgeThreshold    = values.ConsolidationWeakEdgeThreshold    // ④ weight below this AND…
	weakEdgeIdleDays     = values.ConsolidationWeakEdgeIdleDays     // ④ …un-activated since this → pruned
	weakEdgeFloor        = values.ConsolidationWeakEdgeFloor        // ④ pruned links drop here — dim, not gone (§2)
	// gistDedupeWindow: a star nightly-gisted within this window is skipped by the next gist
	// pass — so a lease-reclaimed or re-run consolidate job (huge graph exceeding the 120s
	// claim lease, or multiple workers) doesn't double-advance form_seed_delta for the same
	// night. Shorter than the 24h consolidation cadence (the next night gists normally),
	// longer than any reclaim/backoff retry window.
	gistDedupeWindow = 20 * time.Hour
)

// Server-side force layout constants — the SAME force model as the client force-sim
// (shared/lib/force-sim DEFAULTS, spec 07) so the cached coordinates are equivalent to
// what the client would settle to (acceptance 2.1). Repulsion is exact O(N²) here (not
// Barnes-Hut): per-user star counts are small and the cache is computed once a night, so
// the octree's approximation buys nothing. The coordinates are a re-entry CACHE only —
// the client still emerges its own layout (constitution §3); they are never sent over proto.
const (
	layoutRepulsion     = -30.0
	layoutLinkDistance  = 30.0
	layoutCenterGravity = 0.01
	layoutVelocityDecay = 0.6
	layoutAlphaMin      = 0.001
	layoutLinkStrength  = 1.0
	layoutMinDist       = 1.0   // spring distance floor (coincident linked nodes can't divide to ∞)
	layoutMinDist2      = 1.0   // repulsion dist² floor (mirrors octree MIN_DIST2)
	layoutMaxTicks      = 600   // bounded; alpha decays to alphaMin in ~300 ticks, then we early-stop
	layoutSeedRadius    = 30.0  // deterministic fibonacci shell for un-cached stars (≈ linkDistance)
	layoutSeedJitter    = 0.001 // per-index symmetry-break so coincident seeds still repel (≪ radius)
)

// handleConsolidate runs the four ordered passes for one claimed consolidate job. Each
// pass is its own statement; a mid-pass failure backs the job off (failWithBackoff) and
// re-runs — every pass is idempotent (coords re-cached, form_seed_delta monotonic via
// GREATEST, weight floored via LEAST, history append keyed to the gist set), so a retry
// never corrupts and never deletes (constitution §1·§2, acceptance 5.2).
func (w *Worker) handleConsolidate(ctx context.Context, j Job) error {
	graph, err := w.store.LoadConsolidateGraph(ctx, j.UserID)
	if err != nil {
		return fmt.Errorf("load consolidate graph: %w", err)
	}
	if len(graph.Stars) == 0 {
		// A user with no stars (rare: deleted everything? — never happens, §2). Nothing to
		// consolidate; complete so the job doesn't retry forever.
		if err := w.jobs.Complete(ctx, j.ID); err != nil {
			return fmt.Errorf("complete (empty): %w", err)
		}
		return nil
	}
	now := time.Now().UTC()

	// ① re-stabilize + ② redistribute — pure, in-memory; result is a re-entry CACHE (§3).
	coords := consolidateLayout(graph)
	redistribute(coords, graph)
	stable := make([]StableCoord, 0, len(graph.Stars))
	for _, s := range graph.Stars {
		p := coords[s.ID]
		stable = append(stable, StableCoord{ID: s.ID, X: p[0], Y: p[1], Z: p[2]})
	}

	// Passes ②(cache) → ③ gist (+nightly_gist history) → ④ prune → job complete, ALL in one
	// transaction (RunConsolidation). Atomic completion is the retry fence: the gist step is
	// monotonic but not idempotent, so a failure must roll back every write together rather
	// than leave a half-applied (and re-appliable) consolidation. ⑤ excitability reset (24h
	// rotation) is a NO-OP: e(c,t) (spec 22) is derived from last_recalled_at/last_activated_at
	// with τ=6h and has no persistent column — by the time this runs (hours after the day's
	// activity) morning's e is already ≈0 by time-decay, so the reset is intrinsic, not a write.
	gisted, err := w.store.RunConsolidation(ctx, j.ID, j.UserID, ConsolidationWrite{
		Coords:           stable,
		Simplify:         gistFormSimplify,
		AgeCutoff:        daysBefore(now, gistAgeDays),
		RecallCutoff:     daysBefore(now, gistRecallCutoffDays),
		GistDedupeCutoff: now.Add(-gistDedupeWindow),
		WeakThreshold:    weakEdgeThreshold,
		Floor:            weakEdgeFloor,
		IdleCutoff:       daysBefore(now, weakEdgeIdleDays),
	})
	if err != nil {
		return err
	}
	w.logger.Info("consolidate done",
		"user", j.UserID, "stars", len(graph.Stars), "links", len(graph.Links), "gisted", gisted)
	return nil
}

// --- pure layout helpers (unit-tested) ---

type vec3 = [3]float64

// consolidateLayout runs the server-side force-sim to convergence and returns the
// settled coordinate per star id (pass ①). Every star is free (the night fully
// re-stabilizes — the daytime pin policy is released, spec 결정1). Stars with a cached
// stable coordinate resume from it (faster re-convergence); the rest seed on a
// deterministic fibonacci shell so the layout is reproducible and well-spread.
func consolidateLayout(graph ConsolidateGraph) map[string]vec3 {
	n := len(graph.Stars)
	ids := make([]string, n)
	index := make(map[string]int, n)
	px := make([]vec3, n)
	vx := make([]vec3, n)
	for i, s := range graph.Stars {
		ids[i] = s.ID
		index[s.ID] = i
		if s.StableX != nil && s.StableY != nil && s.StableZ != nil {
			px[i] = vec3{*s.StableX, *s.StableY, *s.StableZ}
		} else {
			px[i] = fibonacciSeed(i, n)
		}
		// Deterministic per-index symmetry-break (≪ seed radius): two stars that seed at
		// EXACTLY the same point (e.g. a prior night's redistribute collapsed a cluster onto
		// one centroid and cached identical coords) would otherwise get zero net force on
		// every axis — dx=dy=dz=0 makes both repulsion and the spring vanish — and stay
		// stacked forever. A tiny i-derived offset guarantees distinct positions so the
		// relaxation can separate them. Negligible vs layoutSeedRadius, so a normal layout
		// is unaffected.
		px[i][0] += float64(i%7-3) * layoutSeedJitter
		px[i][1] += float64((i/7)%7-3) * layoutSeedJitter
		px[i][2] += float64((i/49)%7-3) * layoutSeedJitter
	}

	type simEdge struct {
		a, b int
		w    float64
	}
	edges := make([]simEdge, 0, len(graph.Links))
	for _, l := range graph.Links {
		a, okA := index[l.AID]
		b, okB := index[l.BID]
		if okA && okB && a != b {
			edges = append(edges, simEdge{a: a, b: b, w: l.Weight})
		}
	}

	alpha := 1.0
	alphaDecay := 1 - math.Pow(layoutAlphaMin, 1.0/300.0)
	for t := 0; t < layoutMaxTicks && alpha > layoutAlphaMin; t++ {
		// Repulsion (exact O(N²)): every pair pushes apart, w = repulsion / dist² (dist² floored).
		for i := 0; i < n; i++ {
			var fx, fy, fz float64
			for k := 0; k < n; k++ {
				if k == i {
					continue
				}
				dx := px[k][0] - px[i][0]
				dy := px[k][1] - px[i][1]
				dz := px[k][2] - px[i][2]
				d2 := dx*dx + dy*dy + dz*dz
				if d2 < layoutMinDist2 {
					d2 = layoutMinDist2
				}
				w := layoutRepulsion / d2
				fx += dx * w
				fy += dy * w
				fz += dz * w
			}
			vx[i][0] += fx * alpha
			vx[i][1] += fy * alpha
			vx[i][2] += fz * alpha
		}

		// Attraction along edges (spring toward linkDistance, scaled by weight).
		for _, e := range edges {
			dx := px[e.b][0] - px[e.a][0]
			dy := px[e.b][1] - px[e.a][1]
			dz := px[e.b][2] - px[e.a][2]
			dist := math.Sqrt(dx*dx + dy*dy + dz*dz)
			if dist < layoutMinDist {
				dist = layoutMinDist
			}
			f := ((dist - layoutLinkDistance) / dist) * e.w * layoutLinkStrength * alpha
			vx[e.a][0] += dx * f
			vx[e.a][1] += dy * f
			vx[e.a][2] += dz * f
			vx[e.b][0] -= dx * f
			vx[e.b][1] -= dy * f
			vx[e.b][2] -= dz * f
		}

		// Center gravity + integrate (velocity damp → move).
		for i := 0; i < n; i++ {
			vx[i][0] += -px[i][0] * layoutCenterGravity * alpha
			vx[i][1] += -px[i][1] * layoutCenterGravity * alpha
			vx[i][2] += -px[i][2] * layoutCenterGravity * alpha
			vx[i][0] *= layoutVelocityDecay
			vx[i][1] *= layoutVelocityDecay
			vx[i][2] *= layoutVelocityDecay
			px[i][0] += vx[i][0]
			px[i][1] += vx[i][1]
			px[i][2] += vx[i][2]
		}

		alpha += (0 - alpha) * alphaDecay
	}

	out := make(map[string]vec3, n)
	for i, id := range ids {
		out[id] = px[i]
	}
	return out
}

// fibonacciSeed places star i of n on a deterministic golden-angle sphere (radius
// layoutSeedRadius). Reproducible (no RNG) and well-spread, so the force relaxation
// converges to a stable layout regardless of insertion order.
func fibonacciSeed(i, n int) vec3 {
	if n <= 1 {
		return vec3{0, 0, 0}
	}
	ga := math.Pi * (3 - math.Sqrt(5)) // golden angle
	y := 1 - (float64(i)/float64(n-1))*2
	r := math.Sqrt(math.Max(0, 1-y*y))
	theta := ga * float64(i)
	return vec3{
		math.Cos(theta) * r * layoutSeedRadius,
		y * layoutSeedRadius,
		math.Sin(theta) * r * layoutSeedRadius,
	}
}

// redistribute pulls every star toward its host cluster's centroid (pass ②). A star in
// a recurring "schema" cluster (≥schemaMinCluster members) that is itself well-connected
// (≥schemaMinDegree synapses) is pulled a little harder (schemaBonus) — schema-fit
// memories consolidate faster (Audrain & McAndrews 2022). Mutates `coords` in place.
// Singletons (cluster of one) sit at their own centroid, so the pull is a no-op for them.
func redistribute(coords map[string]vec3, graph ConsolidateGraph) {
	cluster := consolidateClusters(graph)
	sum := make(map[string]vec3)
	count := make(map[string]int)
	for id, root := range cluster {
		p := coords[id]
		s := sum[root]
		sum[root] = vec3{s[0] + p[0], s[1] + p[1], s[2] + p[2]}
		count[root]++
	}
	degree := make(map[string]int)
	for _, l := range graph.Links {
		degree[l.AID]++
		degree[l.BID]++
	}
	for id := range coords {
		root, ok := cluster[id]
		if !ok {
			continue
		}
		c := count[root]
		centroid := vec3{sum[root][0] / float64(c), sum[root][1] / float64(c), sum[root][2] / float64(c)}
		lerp := redistributeLerp
		if c >= schemaMinCluster && degree[id] >= schemaMinDegree {
			lerp = math.Min(0.95, lerp+schemaBonus)
		}
		p := coords[id]
		coords[id] = vec3{
			p[0] + (centroid[0]-p[0])*lerp,
			p[1] + (centroid[1]-p[1])*lerp,
			p[2] + (centroid[2]-p[2])*lerp,
		}
	}
}

// consolidateClusters groups stars into connected components over their synapses
// (union-find), returning star id → cluster root. An isolated star is its own cluster.
// Union by rank so the root is stable regardless of link iteration order (DB row order
// is unspecified) — the centroid a star is pulled toward doesn't flip between runs.
func consolidateClusters(graph ConsolidateGraph) map[string]string {
	parent := make(map[string]string, len(graph.Stars))
	rank := make(map[string]int, len(graph.Stars))
	for _, s := range graph.Stars {
		parent[s.ID] = s.ID
	}
	var find func(string) string
	find = func(x string) string {
		p, ok := parent[x]
		if !ok {
			return x
		}
		if p != x {
			parent[x] = find(p)
		}
		return parent[x]
	}
	union := func(a, b string) {
		ra, rb := find(a), find(b)
		if ra == rb {
			return
		}
		if rank[ra] < rank[rb] {
			ra, rb = rb, ra
		}
		parent[rb] = ra
		if rank[ra] == rank[rb] {
			rank[ra]++
		}
	}
	for _, l := range graph.Links {
		_, okA := parent[l.AID]
		_, okB := parent[l.BID]
		if okA && okB {
			union(l.AID, l.BID)
		}
	}
	out := make(map[string]string, len(graph.Stars))
	for _, s := range graph.Stars {
		out[s.ID] = find(s.ID)
	}
	return out
}

// daysBefore is now minus `days` days (the gist/prune time cutoffs).
func daysBefore(now time.Time, days float64) time.Time {
	return now.Add(-time.Duration(days * 24 * float64(time.Hour)))
}

// --- nightly ticker (producer) ---

// consolidateHourUTC is the daily wake-up hour (UTC). 18:00 UTC ≈ 03:00 KST (UTC+9) —
// deep night for the beta audience, when interactive embed/extract load is lowest.
const consolidateHourUTC = 18

// StartNightlyConsolidation blocks until ctx is cancelled, enqueuing one consolidate
// job per active user once a day at consolidateHourUTC (spec 27, acceptance 1.1). It is
// started alongside the Worker (cmd/api in the single-binary deploy, cmd/worker when the
// worker is split out) and shares the signal-cancelled ctx so it stops on shutdown.
// Enqueue is idempotent per user (Scheduler.EnqueueConsolidate), so running this in both
// binaries — or a daily wake-up firing twice — never stacks duplicate jobs.
func StartNightlyConsolidation(ctx context.Context, sched Scheduler, logger *slog.Logger) {
	if logger == nil {
		logger = slog.Default()
	}
	logger.Info("nightly consolidation ticker started", "hour_utc", consolidateHourUTC)
	for {
		delay := durationUntilHour(time.Now().UTC(), consolidateHourUTC)
		select {
		case <-ctx.Done():
			logger.Info("nightly consolidation ticker stopped")
			return
		case <-time.After(delay):
		}
		enqueueConsolidation(ctx, sched, logger)
	}
}

// enqueueConsolidation enqueues a consolidate job for every active user. A failure on one
// user is logged and skipped — one user's enqueue error must not block the rest, and the
// next night retries anyway.
func enqueueConsolidation(ctx context.Context, sched Scheduler, logger *slog.Logger) {
	users, err := sched.ActiveUserIDs(ctx)
	if err != nil {
		if ctx.Err() == nil {
			logger.Warn("nightly consolidation: list active users failed", "err", err)
		}
		return
	}
	var enqueued int
	for _, uid := range users {
		if ctx.Err() != nil {
			return
		}
		ok, err := sched.EnqueueConsolidate(ctx, uid)
		if err != nil {
			logger.Warn("nightly consolidation: enqueue failed", "user", uid, "err", err)
			continue
		}
		if ok {
			enqueued++
		}
	}
	logger.Info("nightly consolidation enqueued", "active_users", len(users), "enqueued", enqueued)
}

// durationUntilHour returns the time from `now` until the next occurrence of `hour`:00
// UTC (today if still ahead, else tomorrow). Pure → unit-tested.
func durationUntilHour(now time.Time, hour int) time.Duration {
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, 0, 0, 0, time.UTC)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next.Sub(now)
}
