package memory

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func launchDate() time.Time {
	return time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)
}

// runLink wires launched through a real LinkService on the fake store's tx and
// returns the committed synapses (staging → committed mirrors the real all-or-
// nothing transaction).
func runLink(t *testing.T, store *fakeLaunchStore, launched []LaunchedMemory) []Synapse {
	t.Helper()
	ids := 0
	link := NewLinkService(LinkDeps{
		Now:   func() time.Time { return time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC) },
		NewID: func() string { ids++; return fmt.Sprintf("syn-%d", ids) },
	})
	scope := testScope(t)
	err := store.InLaunchTx(context.Background(), func(tx LaunchTx) error {
		return link.LinkLaunched(context.Background(), scope, tx, launched)
	})
	if err != nil {
		t.Fatalf("LinkLaunched failed: %v", err)
	}
	return store.committed.synapses
}

func selfActivations(date time.Time, memoryID string, neuronIDs ...string) []NeuronMemoryActivation {
	activations := make([]NeuronMemoryActivation, 0, len(neuronIDs))
	for _, id := range neuronIDs {
		activations = append(activations, NeuronMemoryActivation{NeuronID: id, MemoryID: memoryID, MemoryDate: date})
	}
	return activations
}

func findSynapse(synapses []Synapse, a string, b string) (Synapse, bool) {
	if b < a {
		a, b = b, a
	}
	for _, synapse := range synapses {
		if synapse.NeuronAID == a && synapse.NeuronBID == b {
			return synapse, true
		}
	}
	return Synapse{}, false
}

// A1 + canonical ordering + A6/A11: one launched memory with n neurons wires all
// n·(n−1)/2 pairs, every pair canonical (a < b) at the same-memory initial [L1].
func TestLinkWiresAllSameMemoryPairs(t *testing.T) {
	t.Parallel()

	store := &fakeLaunchStore{
		coActivations: selfActivations(launchDate(), "m-1", "n1", "n2", "n3", "n4"),
	}
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"n1", "n2", "n3", "n4"},
	}}

	synapses := runLink(t, store, launched)

	if len(synapses) != 6 { // 4·3/2
		t.Fatalf("wired %d synapses, want 6", len(synapses))
	}
	for _, synapse := range synapses {
		if !(synapse.NeuronAID < synapse.NeuronBID) {
			t.Fatalf("synapse pair not canonical: %s, %s", synapse.NeuronAID, synapse.NeuronBID)
		}
		if !almostEqual(float64(synapse.Strength), values.SynapseInitialSameMemory, 1e-6) {
			t.Fatalf("first-time strength = %v, want same-memory initial %v", synapse.Strength, values.SynapseInitialSameMemory)
		}
		if synapse.CoActivationCount != 1 {
			t.Fatalf("co_activation_count = %d, want 1", synapse.CoActivationCount)
		}
		if !synapse.LastActivatedUniverseTime.Equal(launchDate()) {
			t.Fatalf("last_activated = %v, want launch date", synapse.LastActivatedUniverseTime)
		}
	}
}

// A2 [L2]: reusing an existing neuron creates no edge to the prior memory's other
// neurons — only the launched memory's own pair is wired; the shared neuron is the
// link through activation membership.
func TestLinkSharedNeuronCreatesNoExtraEdge(t *testing.T) {
	t.Parallel()

	// Prior memory m-0 held {nShared, nOld}; the launch reuses nShared with nNew.
	store := &fakeLaunchStore{
		existingSynapses: map[string]float64{synapseKey("nOld", "nShared"): values.SynapseInitialSameMemory},
		coActivations: append(
			selfActivations(launchDate(), "m-1", "nShared", "nNew"),
			NeuronMemoryActivation{NeuronID: "nShared", MemoryID: "m-0", MemoryDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
		),
	}
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"nShared", "nNew"},
	}}

	synapses := runLink(t, store, launched)

	if len(synapses) != 1 {
		t.Fatalf("wired %d synapses, want exactly 1 (nNew↔nShared)", len(synapses))
	}
	if _, ok := findSynapse(synapses, "nNew", "nShared"); !ok {
		t.Fatal("expected the launched memory's own pair (nNew↔nShared)")
	}
	if _, ok := findSynapse(synapses, "nNew", "nOld"); ok {
		t.Fatal("no edge should bridge the launch to the prior memory's other neuron")
	}
}

// A3 [L4][E6]: a repeat co-firing whose prior co-activation date is within the
// window earns the temporal bonus on top of Potentiate; outside the window it does
// not. The comparison is on the memories' dates.
func TestLinkTemporalBonusInsideWindowOnly(t *testing.T) {
	t.Parallel()

	priorBase := values.SynapseInitialSameMemory
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"n1", "n2"},
	}}

	inWindow := launchDate().AddDate(0, 0, -values.SynapseTemporalWindowDays) // exactly on the edge
	outWindow := launchDate().AddDate(0, 0, -(values.SynapseTemporalWindowDays + 1))

	for _, testCase := range []struct {
		name      string
		priorDate time.Time
		wantBonus bool
	}{
		{name: "inside window", priorDate: inWindow, wantBonus: true},
		{name: "outside window", priorDate: outWindow, wantBonus: false},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			store := &fakeLaunchStore{
				existingSynapses: map[string]float64{synapseKey("n1", "n2"): priorBase},
				coActivations: append(
					selfActivations(launchDate(), "m-1", "n1", "n2"),
					selfActivations(testCase.priorDate, "m-0", "n1", "n2")...,
				),
			}

			synapses := runLink(t, store, launched)
			if len(synapses) != 1 {
				t.Fatalf("wired %d synapses, want 1", len(synapses))
			}
			potentiated := Potentiate(priorBase, values.SynapsePotentiationRate)
			want := potentiated
			if testCase.wantBonus {
				want = ApplyTemporalBonus(potentiated)
			}
			if !almostEqual(float64(synapses[0].Strength), want, 1e-6) {
				t.Fatalf("strength = %v, want %v (bonus=%v)", synapses[0].Strength, want, testCase.wantBonus)
			}
			if synapses[0].CoActivationCount != 1 {
				t.Fatalf("co_activation_count = %d, want 1", synapses[0].CoActivationCount)
			}
		})
	}
}

// A3 regression [L4]: a pair that co-fired in a near-in-time cluster long ago earns
// NO bonus when it fires together again far outside the window — the bonus reflects
// THIS launch's proximity to a prior co-firing, not any two historical co-firings.
func TestLinkTemporalBonusIgnoresDistantHistory(t *testing.T) {
	t.Parallel()

	priorBase := values.SynapseInitialSameMemory
	clusterStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	clusterEnd := clusterStart.AddDate(0, 0, values.SynapseTemporalWindowDays) // near-in-time cluster
	store := &fakeLaunchStore{
		existingSynapses: map[string]float64{synapseKey("n1", "n2"): priorBase},
		coActivations: append(append(
			selfActivations(clusterStart, "m-a", "n1", "n2"),
			selfActivations(clusterEnd, "m-b", "n1", "n2")...),
			selfActivations(launchDate(), "m-new", "n1", "n2")..., // ~190 days later
		),
	}
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-new", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"n1", "n2"},
	}}

	synapses := runLink(t, store, launched)
	if len(synapses) != 1 {
		t.Fatalf("wired %d synapses, want 1", len(synapses))
	}
	want := Potentiate(priorBase, values.SynapsePotentiationRate) // pure potentiation, no bonus
	if !almostEqual(float64(synapses[0].Strength), want, 1e-6) {
		t.Fatalf("strength = %v, want Potentiate(base) with no bonus %v", synapses[0].Strength, want)
	}
}

// A7 [L8][L9]: a repeat co-firing potentiates the stored base toward the cap and
// never exceeds 1.0, reading the base through the port (no arithmetic re-derived).
func TestLinkRepeatPotentiatesFromReadBaseUnderCap(t *testing.T) {
	t.Parallel()

	base := 0.95
	store := &fakeLaunchStore{
		existingSynapses: map[string]float64{synapseKey("n1", "n2"): base},
		coActivations:    selfActivations(launchDate(), "m-1", "n1", "n2"),
	}
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"n1", "n2"},
	}}

	synapses := runLink(t, store, launched)
	if len(synapses) != 1 {
		t.Fatalf("wired %d synapses, want 1", len(synapses))
	}
	got := float64(synapses[0].Strength)
	if got <= base {
		t.Fatalf("repeat strength = %v, want > base %v", got, base)
	}
	if got > values.SynapseStrengthCap {
		t.Fatalf("repeat strength = %v, want <= cap %v", got, values.SynapseStrengthCap)
	}
	if !almostEqual(got, Potentiate(base, values.SynapsePotentiationRate), 1e-6) {
		t.Fatalf("repeat strength = %v, want Potentiate(base)", got)
	}
}

// A8 [L5][L8]: a pair co-firing in two sibling memories of one launch collapses to
// one canonical row (no duplicate), counting both co-firings; same date → the
// co-activation is in window, so the bonus applies on the potentiation.
func TestLinkAggregatesRepeatedPairInOneLaunch(t *testing.T) {
	t.Parallel()

	store := &fakeLaunchStore{
		coActivations: append(
			selfActivations(launchDate(), "m-1", "n1", "n2"),
			selfActivations(launchDate(), "m-2", "n1", "n2")...,
		),
	}
	launched := []LaunchedMemory{
		{EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()}, NeuronIDs: []string{"n1", "n2"}},
		{EpisodicMemory: EpisodicMemory{ID: "m-2", CreatedUniverseTime: launchDate()}, NeuronIDs: []string{"n1", "n2"}},
	}

	synapses := runLink(t, store, launched)
	if len(synapses) != 1 {
		t.Fatalf("wired %d synapses, want 1 aggregated row", len(synapses))
	}
	if synapses[0].CoActivationCount != 2 {
		t.Fatalf("co_activation_count = %d, want 2", synapses[0].CoActivationCount)
	}
	initial, _ := InitialStrength(SignalKindSameMemory)
	want := ApplyTemporalBonus(Potentiate(initial, values.SynapsePotentiationRate))
	if !almostEqual(float64(synapses[0].Strength), want, 1e-6) {
		t.Fatalf("strength = %v, want %v", synapses[0].Strength, want)
	}
}

// A10 (§4): the launch scope is required; a missing user id never reaches the store.
func TestLinkRequiresScope(t *testing.T) {
	t.Parallel()

	link := NewLinkService(LinkDeps{})
	err := link.LinkLaunched(context.Background(), platform.UserScope{}, &fakeLaunchStore{}, nil)
	if err != ErrScopeRequired {
		t.Fatalf("LinkLaunched error = %v, want ErrScopeRequired", err)
	}
}

// A1 edge case: a lone-neuron memory has no internal pair, so no synapse is wired
// and the launch still succeeds — sharing connects it through membership [L2].
func TestLinkSingleNeuronMemoryWiresNothing(t *testing.T) {
	t.Parallel()

	store := &fakeLaunchStore{coActivations: selfActivations(launchDate(), "m-1", "n1")}
	launched := []LaunchedMemory{{
		EpisodicMemory: EpisodicMemory{ID: "m-1", CreatedUniverseTime: launchDate()},
		NeuronIDs:      []string{"n1"},
	}}

	if synapses := runLink(t, store, launched); len(synapses) != 0 {
		t.Fatalf("wired %d synapses, want 0", len(synapses))
	}
}
