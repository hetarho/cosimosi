package job

import (
	"context"
	"fmt"
	"hash/fnv"
	"log/slog"
	"math"
	"time"

	"github.com/cosimosi/backend/internal/values"
)

// Nightly consolidation — "the universe's sleep" (spec 27 change 20). Once a night the ticker
// enqueues one consolidate job per active user; the worker runs ordered passes over that user's
// graph, then leaves cluster excitability (spec 22) to its natural time-decay so the next day's
// competitive allocation starts fresh (the 24h engram-rotation cycle). NOTHING is deleted:
// stars/synapses are never row-removed (constitution §2); records are never touched (§1).
//
// The passes work off each star's RADIUS (distance from centre), approximated server-side from
// the raw Bjork fields (change-18 formula, radius.go) — the same radius the client renders:
//  ① re-stabilize : server force-sim re-layout, SCOPED to stars within radiusScope (far-drifted
//                    stars are left where they are — forgetting is respected, not undone)
//  ② redistribute : pull each in-scope star toward its host-cluster centroid (no schema bonus)
//  · spread       : nudge each cluster by a deterministic per-root displacement (no clumping)
//  · reweight     : temporal-class links weaken, semantic links strengthen (time-window dissolves)
//  ③ abstract     : radius crossing a stage threshold advances abstraction_stage (append-only history)
//  ④ prune        : weak, long-idle synapses dim + sever, EXCEPT each star's strongest (degree ≥ 1)
//  · re-KNN       : old isolated/severed stars re-link to newly-similar memories (reconnection net)
//  ⑤ excitability : reset — no-op (derived from timestamps, τ=6h; see note at the RunConsolidation site)

// Nightly tuning — single source is spec/values.yaml (consolidation:), generated into the values
// package. gistStageRadii is the array of radius thresholds; crossing each advances one stage (≤4).
const (
	redistributeLerp  = values.ConsolidationRedistributeLerp  // ② host-cluster centroid pull
	radiusScope       = values.ConsolidationRadiusScope       // ①② only stars within this radius are re-stabilized/redistributed
	temporalLinkDecay = values.ConsolidationTemporalLinkDecay // reweight: temporal-class link weight ×= this (<1)
	semanticLinkGain  = values.ConsolidationSemanticLinkGain  // reweight: semantic link weight += this (capped at semanticWeightCap)
	spreadStrength    = values.ConsolidationSpreadStrength    // spread: per-cluster deterministic displacement (world units)
	weakEdgeThreshold = values.ConsolidationWeakEdgeThreshold // ④ weight below this AND…
	weakEdgeIdleDays  = values.ConsolidationWeakEdgeIdleDays  // ④ …un-activated since this → pruned (last link protected)
	weakEdgeFloor     = values.ConsolidationWeakEdgeFloor     // ④ pruned links drop here + severed — dim, not gone (§2)
	reknnMinAgeDays   = values.ConsolidationReknnMinAgeDays   // re-KNN only stars older than this (and isolated/severed)
)

// gistStageRadii: ascending radius thresholds — a star's radius crossing each one is one step of
// abstraction (abstraction_stage = count crossed, ≤4). A var (the generated value is a []float64).
var gistStageRadii = values.ConsolidationGistStageRadii

// Server-side force layout constants — the SAME force model as the client force-sim
// (shared/lib/force-sim DEFAULTS, spec 07) so the cached coordinates are equivalent to
// what the client would settle to (acceptance 2.1). Repulsion is exact O(N²) here (not
// Barnes-Hut): per-user star counts are small and the cache is computed once a night, so
// the octree's approximation buys nothing. The coordinates are a re-entry CACHE only —
// the client still emerges its own layout (constitution §3); they are never sent over proto.
const (
	layoutRepulsion     = values.ForceSimRepulsion
	layoutLinkDistance  = values.ForceSimLinkDistance
	layoutCenterGravity = values.ForceSimCenterGravity
	layoutVelocityDecay = values.ForceSimVelocityDecay
	layoutAlphaMin      = values.ForceSimAlphaMin
	layoutLinkStrength  = values.ForceSimLinkStrength
	layoutMinDist       = values.ForceSimMinDist    // spring distance floor (coincident linked nodes can't divide to ∞)
	layoutMinDist2      = values.ForceSimMinDist2   // repulsion dist² floor (mirrors octree MIN_DIST2)
	layoutMaxTicks      = 600                       // bounded; alpha decays to alphaMin in ~300 ticks, then we early-stop
	layoutSeedRadius    = values.ForceSimSeedRadius // deterministic fibonacci shell for un-cached stars (≈ linkDistance)
	layoutSeedJitter    = 0.001                     // per-index symmetry-break so coincident seeds still repel (≪ radius)
)

// handleConsolidate runs the ordered nightly passes for one claimed consolidate job. A mid-pass
// failure backs the job off (failWithBackoff) and re-runs — every write is idempotent (coords
// re-cached, abstraction_stage monotonic via GREATEST/target>current, weight floored via LEAST,
// re-KNN links GREATEST-upserted), so a retry never corrupts and never deletes (§1·§2).
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
	nowDays := float64(now.Unix()) / 86400.0

	// Each star's radius (change-18 formula, radius.go) drives BOTH the layout scope and the
	// abstraction stage — the server approximates the client-rendered distance from raw fields.
	radii := starRadii(graph, nowDays)

	// ① re-stabilize + ② redistribute + spread — pure, in-memory, SCOPED to the near active region
	// (radius ≤ radiusScope): far-drifted (nearly forgotten) stars are left where they are so the
	// night doesn't keep hauling them back inward (acceptance A2). Result is a re-entry CACHE (§3).
	sub := scopeSubgraph(graph, radii, radiusScope)
	coords := consolidateLayout(sub)
	redistribute(coords, sub)
	spreadClusters(coords, sub)
	stable := make([]StableCoord, 0, len(sub.Stars))
	for _, s := range sub.Stars {
		p := coords[s.ID]
		stable = append(stable, StableCoord{ID: s.ID, X: p[0], Y: p[1], Z: p[2]})
	}

	// Abstraction targets: each star's radius → the count of stage thresholds it has crossed.
	// RunConsolidation raises abstraction_stage to GREATEST(current, target) where it advances.
	stages := make([]StageTarget, 0, len(graph.Stars))
	for _, s := range graph.Stars {
		if st := stageForRadius(radii[s.ID], gistStageRadii); st > 0 {
			stages = append(stages, StageTarget{ID: s.ID, Stage: st})
		}
	}

	// Re-KNN reconnection (reads only — the writes ride RunConsolidation's tx): old isolated/severed
	// stars get a fresh semantic KNN so memories that grew similar since are late-linked.
	reknnLinks, err := w.collectReknnLinks(ctx, j.UserID, daysBefore(now, reknnMinAgeDays))
	if err != nil {
		return fmt.Errorf("re-knn: %w", err)
	}

	// cache(in-scope) → reweight → abstract(+nightly_gist history) → prune(sever, protect) →
	// re-KNN revive/create → job complete, ALL in one transaction (RunConsolidation). Atomic
	// completion is the retry fence: a failure rolls back every write together rather than leave a
	// half-applied consolidation. ⑤ excitability reset (24h rotation) is a NO-OP: e(c,t) (spec 22) is
	// derived from last_recalled_at/last_activated_at with τ=6h and has no persistent column — by the
	// time this runs (hours after the day's activity) morning's e is already ≈0, so the reset is
	// intrinsic, not a write.
	advanced, err := w.store.RunConsolidation(ctx, j.ID, j.UserID, ConsolidationWrite{
		Coords:        stable,
		TemporalDecay: temporalLinkDecay,
		SemanticGain:  semanticLinkGain,
		SemanticCap:   semanticWeightCap,
		GistStages:    stages,
		WeakThreshold: weakEdgeThreshold,
		IdleCutoff:    daysBefore(now, weakEdgeIdleDays),
		Floor:         weakEdgeFloor,
		ReknnLinks:    reknnLinks,
	})
	if err != nil {
		return err
	}
	w.logger.Info("consolidate done",
		"user", j.UserID, "stars", len(graph.Stars), "links", len(graph.Links),
		"in_scope", len(sub.Stars), "advanced", advanced, "reknn", len(reknnLinks))
	return nil
}

// collectReknnLinks runs a fresh semantic KNN for each old isolated/severed star and returns the
// reconnection links to revive/create (spec 27 change 20, acceptance A7). Reads only — the writes
// happen inside RunConsolidation's transaction. Weight is the cosine similarity capped at the
// semantic cap (a re-connection is semantic; no temporal bonus). a<b normalization is done in SQL.
//
// Pairs are deduped by their unordered {a,b} key (keeping the strongest weight): two mutually-near
// candidates (m1→m2 AND m2→m1) would otherwise both reach ReknnUpsertLinks as the same normalized
// row, and a single INSERT…ON CONFLICT cannot touch one row twice. The dedup key uses Go ordering;
// it only needs to collapse the SAME unordered pair (which it does regardless of which end is "a"),
// so it never disagrees with the SQL collation about pair IDENTITY.
func (w *Worker) collectReknnLinks(ctx context.Context, userID string, ageCutoff time.Time) ([]LinkUpsert, error) {
	cands, err := w.store.ReknnCandidates(ctx, userID, ageCutoff, weakEdgeThreshold)
	if err != nil {
		return nil, err
	}
	best := make(map[[2]string]float64)
	for _, c := range cands {
		neighbors, err := w.store.KnnNearest(ctx, userID, c.Vec, c.ID, knnK)
		if err != nil {
			return nil, err
		}
		for _, n := range neighbors {
			key := [2]string{c.ID, n.MemoryID}
			if key[0] > key[1] {
				key[0], key[1] = key[1], key[0]
			}
			wgt := math.Min(n.CosSim, semanticWeightCap)
			if cur, ok := best[key]; !ok || wgt > cur {
				best[key] = wgt
			}
		}
	}
	out := make([]LinkUpsert, 0, len(best))
	for key, wgt := range best {
		out = append(out, LinkUpsert{AID: key[0], BID: key[1], Weight: wgt, UserID: userID})
	}
	return out, nil
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
	alphaDecay := 1 - math.Pow(layoutAlphaMin, 1.0/values.ForceSimAlphaDecayTicks)
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

// scopeSubgraph keeps only the stars within `scope` (the near, active region) and the links
// between them — the re-stabilize/redistribute/spread passes run on this subgraph so far-drifted
// stars keep their cached coords untouched and aren't hauled back inward (spec 27 change 20,
// acceptance A2). Far stars stay out of the cache write too (RunConsolidation only caches these).
func scopeSubgraph(graph ConsolidateGraph, radii map[string]float64, scope float64) ConsolidateGraph {
	in := make(map[string]bool, len(graph.Stars))
	stars := make([]ConsolidateStar, 0, len(graph.Stars))
	for _, s := range graph.Stars {
		if radii[s.ID] <= scope {
			in[s.ID] = true
			stars = append(stars, s)
		}
	}
	links := make([]ConsolidateLink, 0, len(graph.Links))
	for _, l := range graph.Links {
		if in[l.AID] && in[l.BID] {
			links = append(links, l)
		}
	}
	return ConsolidateGraph{Stars: stars, Links: links}
}

// redistribute pulls every star toward its host cluster's centroid (pass ②) by redistributeLerp.
// Mutates `coords` in place. Singletons (cluster of one) sit at their own centroid, so the pull is
// a no-op for them. (Change 20 dropped the schema-fit bonus — every star is pulled the same.)
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
	for id := range coords {
		root, ok := cluster[id]
		if !ok {
			continue
		}
		c := count[root]
		centroid := vec3{sum[root][0] / float64(c), sum[root][1] / float64(c), sum[root][2] / float64(c)}
		p := coords[id]
		coords[id] = vec3{
			p[0] + (centroid[0]-p[0])*redistributeLerp,
			p[1] + (centroid[1]-p[1])*redistributeLerp,
			p[2] + (centroid[2]-p[2])*redistributeLerp,
		}
	}
}

// spreadClusters nudges each cluster by a small deterministic displacement so the redistributed
// clusters don't all collapse toward the origin — they fan out across 3D (spec 27 change 20,
// acceptance A4). The direction is an FNV hash of the cluster's CANONICAL key → a point on the unit
// sphere, so it is reproducible (no RNG, no clock): same input graph → same spread. Mutates coords
// in place. The canonical key is the cluster's MIN member id (order-independent) — NOT the union-find
// root, whose identity depends on link iteration order (equal-rank ties keep find(a)); hashing the
// root would drift the offset between otherwise-identical nightly runs.
func spreadClusters(coords map[string]vec3, graph ConsolidateGraph) {
	cluster := consolidateClusters(graph)
	canon := make(map[string]string) // root → min member id (order-independent cluster key)
	for id, root := range cluster {
		if cur, ok := canon[root]; !ok || id < cur {
			canon[root] = id
		}
	}
	off := make(map[string]vec3)
	for _, root := range cluster {
		if _, ok := off[root]; !ok {
			d := spreadDirection(canon[root])
			off[root] = vec3{d[0] * spreadStrength, d[1] * spreadStrength, d[2] * spreadStrength}
		}
	}
	for id := range coords {
		if root, ok := cluster[id]; ok {
			o := off[root]
			p := coords[id]
			coords[id] = vec3{p[0] + o[0], p[1] + o[1], p[2] + o[2]}
		}
	}
}

// spreadDirection maps a cluster root id to a deterministic point on the unit sphere via an FNV-1a
// hash split into two uniforms (no RNG/clock — reproducible spread, acceptance A4).
func spreadDirection(id string) vec3 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(id))
	sum := h.Sum64()
	u1 := float64(sum&0xffffffff) / float64(1<<32)
	u2 := float64((sum>>32)&0xffffffff) / float64(1<<32)
	theta := 2 * math.Pi * u1
	z := 2*u2 - 1
	r := math.Sqrt(math.Max(0, 1-z*z))
	return vec3{r * math.Cos(theta), r * math.Sin(theta), z}
}

// consolidateClusters groups stars into connected components over their synapses
// (union-find), returning star id → cluster root. An isolated star is its own cluster.
// Union by rank so the root is stable regardless of link iteration order (DB row order
// is unspecified) — the centroid a star is pulled toward doesn't flip between runs.
func consolidateClusters(graph ConsolidateGraph) map[string]string {
	ids := make([]string, 0, len(graph.Stars))
	for _, s := range graph.Stars {
		ids = append(ids, s.ID)
	}
	pairs := make([][2]string, 0, len(graph.Links))
	for _, l := range graph.Links {
		pairs = append(pairs, [2]string{l.AID, l.BID})
	}
	return clusterByUnionFind(ids, pairs)
}

// daysBefore is now minus `days` days (the gist/prune time cutoffs).
func daysBefore(now time.Time, days float64) time.Time {
	return now.Add(-time.Duration(days * 24 * float64(time.Hour)))
}

// --- nightly ticker (producer) ---

// consolidateHourUTC is the daily wake-up hour (UTC). 19:00 UTC = 04:00 KST (UTC+9) —
// deep night for the beta audience, when interactive embed/extract load is lowest.
const consolidateHourUTC = values.ConsolidationHourUtc

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
