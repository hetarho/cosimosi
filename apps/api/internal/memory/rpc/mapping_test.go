package rpc

import (
	"errors"
	"testing"
	"time"

	"connectrpc.com/connect"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	"github.com/cosimosi/api/internal/memory"
)

// The handler is the proto↔domain anti-corruption boundary (§2.7): these tests pin the pure
// mappers so a field renamed on one side without the other fails here, not in production.

func TestDomainMemoriesMapsConfirmedWire(t *testing.T) {
	wire := []*memoryv1.ConfirmedMemory{
		{
			Name: "Morning run",
			Mood: "JOY",
			Neurons: []*memoryv1.ProposedNeuron{
				{Name: "river", Type: "place"},
				{Name: "resolve", Type: "concept"},
			},
		},
	}

	got := domainMemories(wire)

	if len(got) != 1 {
		t.Fatalf("want 1 memory, got %d", len(got))
	}
	m := got[0]
	if m.Name != "Morning run" || m.Mood != memory.Mood("JOY") {
		t.Fatalf("memory scalars not mapped: %+v", m)
	}
	if len(m.Neurons) != 2 {
		t.Fatalf("want 2 neurons, got %d", len(m.Neurons))
	}
	if m.Neurons[0].Name != "river" || m.Neurons[0].Type != memory.NeuronType("place") {
		t.Fatalf("neuron[0] not mapped: %+v", m.Neurons[0])
	}
	if m.Neurons[1].Type != memory.NeuronType("concept") {
		t.Fatalf("neuron[1] type not mapped: %+v", m.Neurons[1])
	}
}

func TestSplitResponseMapsDomainResult(t *testing.T) {
	result := memory.ExtractResult{Memories: []memory.ExtractedMemory{
		{Name: "A", Mood: memory.Mood("CALM"), Neurons: []memory.ExtractedNeuron{
			{Name: "sea", Type: memory.NeuronType("place")},
		}},
	}}

	got := splitResponse(result)

	if len(got.GetMemories()) != 1 {
		t.Fatalf("want 1 proto memory, got %d", len(got.GetMemories()))
	}
	pm := got.GetMemories()[0]
	if pm.GetName() != "A" || pm.GetMood() != "CALM" {
		t.Fatalf("proto memory scalars not mapped: %+v", pm)
	}
	if len(pm.GetNeurons()) != 1 || pm.GetNeurons()[0].GetName() != "sea" || pm.GetNeurons()[0].GetType() != "place" {
		t.Fatalf("proto neuron not mapped: %+v", pm.GetNeurons())
	}
}

func TestUniverseResponseMapsFactsAndGroupsActivations(t *testing.T) {
	created := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	recalled := time.Date(2026, 4, 2, 0, 0, 0, 0, time.UTC)
	seed := int64(42)
	name := "hippocampus"
	facts := memory.UniverseFacts{
		EpisodicMemories: []memory.EpisodicMemory{
			{
				ID:                       "mem-1",
				Name:                     "First",
				Seed:                     &seed,
				Emotion:                  memory.Emotion{Mood: memory.Mood("JOY"), Valence: 0.5, Arousal: 0.4, Intensity: 0.6},
				BaseStrength:             0.3,
				RecallCount:              2,
				CreatedUniverseTime:      created,
				LastRecalledUniverseTime: &recalled,
			},
			{
				ID:                  "mem-2",
				Name:                "Second",
				CreatedUniverseTime: created,
				// LastRecalledUniverseTime nil → the DTO field must stay nil.
			},
		},
		Neurons: []memory.NeuronWithConnectivity{
			{Neuron: memory.Neuron{ID: "n-1", Name: &name, Type: memory.NeuronType("place")}, Connectivity: 3},
		},
		Activations: []memory.NeuronActivation{
			{EpisodicMemoryID: "mem-1", NeuronID: "n-1", Weight: 1.0},
			{EpisodicMemoryID: "mem-1", NeuronID: "n-2", Weight: 0.5},
			{EpisodicMemoryID: "mem-2", NeuronID: "n-1", Weight: 1.0},
		},
		Synapses: []memory.Synapse{
			{ID: "s-1", NeuronAID: "n-1", NeuronBID: "n-2", Strength: 0.8, CoActivationCount: 4, LastActivatedUniverseTime: created},
		},
	}
	universeTime := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)

	got := universeResponse(facts, &universeTime)

	if got.GetUniverseTime() != "2026-05-01" {
		t.Fatalf("universe time not formatted: %q", got.GetUniverseTime())
	}
	if len(got.GetMemories()) != 2 {
		t.Fatalf("want 2 memories, got %d", len(got.GetMemories()))
	}
	first := got.GetMemories()[0]
	if first.GetId() != "mem-1" || first.GetName() != "First" {
		t.Fatalf("memory scalars not mapped: %+v", first)
	}
	if first.GetCreatedUniverseTime() != "2026-03-01" || first.GetLastRecalledUniverseTime() != "2026-04-02" {
		t.Fatalf("memory dates not mapped: %+v", first)
	}
	if first.Seed == nil || first.GetSeed() != 42 {
		t.Fatalf("seed not passed through: %+v", first.Seed)
	}
	if first.GetEmotion().GetMood() != "JOY" || first.GetEmotion().GetValence() != 0.5 ||
		first.GetEmotion().GetArousal() != 0.4 || first.GetEmotion().GetIntensity() != 0.6 {
		// All four scalars asserted: valence/arousal/intensity share a type, so only distinct
		// expected values catch a field being wired to the wrong source (e.g. arousal<->intensity).
		t.Fatalf("emotion not mapped: %+v", first.GetEmotion())
	}
	if len(first.GetActivations()) != 2 {
		t.Fatalf("mem-1 should group 2 activations, got %d", len(first.GetActivations()))
	}
	if got.GetMemories()[1].LastRecalledUniverseTime != nil {
		t.Fatalf("nil recall time must stay nil, got %v", got.GetMemories()[1].LastRecalledUniverseTime)
	}
	if len(got.GetMemories()[1].GetActivations()) != 1 {
		t.Fatalf("mem-2 should group 1 activation, got %d", len(got.GetMemories()[1].GetActivations()))
	}
	if len(got.GetNeurons()) != 1 || got.GetNeurons()[0].GetName() != "hippocampus" ||
		got.GetNeurons()[0].GetConnectivity() != 3 || got.GetNeurons()[0].GetNeuronType() != "place" {
		t.Fatalf("neuron not mapped: %+v", got.GetNeurons())
	}
	if len(got.GetSynapses()) != 1 || got.GetSynapses()[0].GetStrength() != 0.8 || got.GetSynapses()[0].GetCoActivationCount() != 4 {
		t.Fatalf("synapse not mapped: %+v", got.GetSynapses())
	}
}

func TestUniverseResponseEmptyUniverseTime(t *testing.T) {
	got := universeResponse(memory.UniverseFacts{}, nil)
	if got.GetUniverseTime() != "" {
		t.Fatalf("nil universe time must map to empty string, got %q", got.GetUniverseTime())
	}
}

func TestLaunchIntervalDateValueMapping(t *testing.T) {
	previous := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	advanced := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)

	// Launchable: {previous, advanced} round-trips as ISO DATE strings.
	if got := dateValue(&previous); got != "2026-06-20" {
		t.Fatalf("previous = %q, want 2026-06-20", got)
	}
	if got := dateValue(&advanced); got != "2026-07-02" {
		t.Fatalf("advanced = %q, want 2026-07-02", got)
	}
	// First-ever launch: nil previous maps to the empty-until-set convention.
	if got := dateValue(nil); got != "" {
		t.Fatalf("nil previous = %q, want empty", got)
	}
}

func TestParseDiaryDate(t *testing.T) {
	got, err := parseDiaryDate("2026-03-01")
	if err != nil {
		t.Fatalf("valid date rejected: %v", err)
	}
	if !got.Equal(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("parsed date wrong: %v", got)
	}
	if _, err := parseDiaryDate("not-a-date"); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("bad date should be InvalidArgument, got %v", err)
	}
}

func TestDomainErrorMapsCanonicalErrors(t *testing.T) {
	cases := []struct {
		err  error
		want connect.Code
	}{
		{memory.ErrEncodeInputRequired, connect.CodeInvalidArgument},
		{memory.ErrLaunchInvalidMemories, connect.CodeInvalidArgument},
		{memory.ErrEncodeRetryExhausted, connect.CodeResourceExhausted},
		{memory.ErrEncodeInvalidSplit, connect.CodeInternal},
		{memory.ErrScopeRequired, connect.CodeUnauthenticated},
	}
	for _, c := range cases {
		if got := connect.CodeOf(domainError(c.err)); got != c.want {
			t.Fatalf("domainError(%v) = %v, want %v", c.err, got, c.want)
		}
	}
	// A non-canonical error passes through unwrapped (no synthetic code).
	other := errors.New("boom")
	if got := domainError(other); !errors.Is(got, other) {
		t.Fatalf("unknown error should pass through, got %v", got)
	}
}
