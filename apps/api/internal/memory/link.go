package memory

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// LinkService implements the Linker seam: it grows the neuron synapse
// graph as the last step of PersistEncoded's transaction. It is pure orchestration
// over the plasticity functions and the SynapseStore port — it owns no IO,
// only the id/clock seams every synapse row needs.
//
// The launch path (decided 2026-07) runs the linking rules synchronously over the
// launched memory's own neurons:
//   - Rule 1 [L1]: every within-memory neuron pair is wired (same-memory Hebbian).
//   - Rule 2 [L2]: a reused neuron connects its memories through its activation
//     membership — Link creates no extra edge; the shared neuron *is* the link.
//   - Rule 3 [L4]: a pair that fires together again in a memory created within
//     synapse.temporal_window_days of a prior co-firing earns synapse.temporal_bonus.
//
// Cross-memory refinement *beyond* the launched neurons (rescanning the wider
// graph) is the reserved async `link` job's concern (§2.8) and is not run
// here. Every edge is neuron↔neuron ([L6][I6]); there is never a memory↔memory
// edge, and memory clusters stay emergent ([I5][L7]). All strength math delegates to
// the plasticity functions [A11]; Link only inserts or strengthens [I1].
type LinkService struct {
	now   func() time.Time
	newID func() string
}

type LinkDeps struct {
	// Now/NewID are test seams; nil selects the real clock and id generator.
	Now   func() time.Time
	NewID func() string
}

func NewLinkService(deps LinkDeps) *LinkService {
	link := &LinkService{now: deps.Now, newID: deps.NewID}
	if link.now == nil {
		link.now = func() time.Time { return time.Now().UTC() }
	}
	if link.newID == nil {
		link.newID = platform.NewID
	}
	return link
}

// LinkLaunched wires the launched memories' synapses inside PersistEncoded's
// transaction. It is idempotent under the write's own retry: the whole tx re-runs,
// and each canonical pair advances exactly one row via the atomic upsert [L5][L8].
//
// The stored base is read here and written absolutely by the upsert, while
// co_activation_count increments relatively (a baseline upsert). This is
// correct under the product's per-user serial launch model (the diary-monotonic
// universe clock); concurrent same-user launches of the same pair are not a
// supported path, matching PersistEncoded's other optimistic reads (§2.8).
func (l *LinkService) LinkLaunched(ctx context.Context, scope platform.UserScope, tx LaunchTx, launched []LaunchedMemory) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}

	// Rule 1 [L1]: enumerate every within-memory neuron pair, canonicalised to
	// neuron_a_id < neuron_b_id. A pair co-firing in more than one launched memory
	// accumulates occurrences (each co-firing is one co_activation_count) and
	// advances last_activated to the latest such memory's date.
	pairs := map[pairKey]*linkPair{}
	neuronSet := map[string]struct{}{}
	launchedMemoryIDs := map[string]struct{}{}
	for _, memory := range launched {
		launchedMemoryIDs[memory.ID] = struct{}{}
		ids := dedupIDs(memory.NeuronIDs)
		for _, id := range ids {
			neuronSet[id] = struct{}{}
		}
		for i := 0; i < len(ids); i++ {
			for j := i + 1; j < len(ids); j++ {
				key := canonicalPair(ids[i], ids[j])
				pair := pairs[key]
				if pair == nil {
					pair = &linkPair{a: key.a, b: key.b}
					pairs[key] = pair
				}
				pair.occurrences++
				if pair.latestDate.Before(memory.CreatedUniverseTime) {
					pair.latestDate = memory.CreatedUniverseTime
				}
			}
		}
	}
	if len(pairs) == 0 {
		// Every launched memory carried fewer than two neurons — a single-neuron
		// memory has no internal edges to wire. Rule 2's sharing still connects it
		// through activation membership, which needs no synapse [L2].
		return nil
	}

	neuronIDs := make([]string, 0, len(neuronSet))
	for id := range neuronSet {
		neuronIDs = append(neuronIDs, id)
	}

	// Repeat-path bases [L8]: one query for every pre-existing synapse among the
	// launched neurons; a pair absent here is first-time and seeded from the initial.
	strengths, err := tx.SynapseStrengths(ctx, scope, neuronIDs)
	if err != nil {
		return err
	}
	baseByPair := make(map[pairKey]float64, len(strengths))
	for _, strength := range strengths {
		baseByPair[canonicalPair(strength.NeuronAID, strength.NeuronBID)] = strength.Strength
	}

	// Rule 3 [L4][E6]: the launched neurons' memory memberships (with dates), so the
	// temporal bonus can be timed on the memories' dates. The read runs after this
	// launch's activations are persisted, so it already sees them alongside priors.
	activations, err := tx.CoActivations(ctx, scope, neuronIDs)
	if err != nil {
		return err
	}
	memoryDatesByNeuron := make(map[string]map[string]time.Time, len(neuronSet))
	for _, activation := range activations {
		dates := memoryDatesByNeuron[activation.NeuronID]
		if dates == nil {
			dates = map[string]time.Time{}
			memoryDatesByNeuron[activation.NeuronID] = dates
		}
		dates[activation.MemoryID] = activation.MemoryDate
	}

	for key, pair := range pairs {
		base, found := baseByPair[key]
		near := temporalNear(launchedMemoryIDs, memoryDatesByNeuron[pair.a], memoryDatesByNeuron[pair.b])
		strength := computeLinkStrength(base, found, pair.occurrences, near)
		if _, err := tx.UpsertSynapse(ctx, scope, Synapse{
			ID:                        l.newID(),
			NeuronAID:                 pair.a,
			NeuronBID:                 pair.b,
			Strength:                  float32(strength),
			CoActivationCount:         pair.occurrences,
			LastActivatedUniverseTime: pair.latestDate,
			CreatedAt:                 l.now(),
		}); err != nil {
			return err
		}
	}
	return nil
}

type pairKey struct {
	a string
	b string
}

type linkPair struct {
	a           string
	b           string
	occurrences int32
	latestDate  time.Time
}

func canonicalPair(x string, y string) pairKey {
	if x < y {
		return pairKey{a: x, b: y}
	}
	return pairKey{a: y, b: x}
}

func dedupIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// computeLinkStrength folds one launch's co-firings of a same-memory pair into the
// stored base, delegating every step to the plasticity functions [A11]: a first-time pair starts at
// the same-memory initial [L1][L10]; each further co-firing potentiates toward the
// cap [L8][L9]; the temporal bonus is added once for this launch when its co-firing
// is in window [L4]. It re-implements no strength arithmetic of its own.
func computeLinkStrength(base float64, found bool, occurrences int32, near bool) float64 {
	remaining := occurrences
	if !found {
		base, _ = InitialStrength(SignalKindSameMemory)
		remaining-- // the first co-firing seeds the initial; the rest potentiate
	}
	for i := int32(0); i < remaining; i++ {
		base = Potentiate(base, values.SynapsePotentiationRate)
	}
	if near {
		base = ApplyTemporalBonus(base)
	}
	return base
}

// temporalNear reports whether THIS launch's co-firing of a pair is close in time
// to another co-firing of the same pair — the [L4] condition that earns the bonus
// (neurons that fire together in episodic memories created within
// synapse.temporal_window_days). The co-activation memories are those that activate
// both neurons; the check anchors on a launched co-firing and compares its date
// against the other co-activations, so a distant repeat of an old near-in-time
// cluster earns nothing. Dates come from the memories, never a neuron [E6].
func temporalNear(launchedMemoryIDs map[string]struct{}, aMemories map[string]time.Time, bMemories map[string]time.Time) bool {
	coActivations := make(map[string]time.Time)
	for memoryID, date := range aMemories {
		if _, ok := bMemories[memoryID]; ok {
			coActivations[memoryID] = date
		}
	}
	if len(coActivations) < 2 {
		return false
	}
	window := float64(values.SynapseTemporalWindowDays)
	for memoryID, date := range coActivations {
		if _, launchedHere := launchedMemoryIDs[memoryID]; !launchedHere {
			continue
		}
		for otherID, otherDate := range coActivations {
			if otherID == memoryID {
				continue
			}
			if daysBetween(date, otherDate) <= window {
				return true
			}
		}
	}
	return false
}

func daysBetween(a time.Time, b time.Time) float64 {
	diff := a.Sub(b).Hours() / 24
	if diff < 0 {
		return -diff
	}
	return diff
}
