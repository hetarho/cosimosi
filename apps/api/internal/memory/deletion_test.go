package memory

import (
	"reflect"
	"testing"
)

func TestClassifyNeuronsPartitionsOrphanVsShared(t *testing.T) {
	t.Parallel()
	// Removing memory m1. n-orphan is activated only by m1; n-shared is also activated by the live
	// outside memory m2; n-retained-outside is activated outside the set by a soft-deleted-but-retained
	// memory; n-inside-only is activated by m1 and by the also-removed m3. A swept owner is represented
	// by no activation fact and therefore does not appear here.
	orphans, shared := ClassifyNeurons(
		[]string{"m1", "m3"},
		[]string{"n-orphan", "n-shared", "n-retained-outside", "n-swept-outside", "n-inside-only"},
		[]NeuronActivationFact{
			{NeuronID: "n-orphan", EpisodicMemoryID: "m1"},
			{NeuronID: "n-shared", EpisodicMemoryID: "m1"},
			{NeuronID: "n-shared", EpisodicMemoryID: "m2"},
			{NeuronID: "n-retained-outside", EpisodicMemoryID: "m1"},
			{NeuronID: "n-retained-outside", EpisodicMemoryID: "m9"},
			{NeuronID: "n-swept-outside", EpisodicMemoryID: "m1"},
			{NeuronID: "n-inside-only", EpisodicMemoryID: "m1"},
			{NeuronID: "n-inside-only", EpisodicMemoryID: "m3"},
		},
	)

	// A1: every retained outside owner keeps a neuron shared. A swept owner contributes no fact, while
	// an activation from another memory inside the same removal set does not count as outside ownership.
	wantOrphans := []string{"n-orphan", "n-swept-outside", "n-inside-only"}
	wantShared := []string{"n-shared", "n-retained-outside"}
	if !reflect.DeepEqual(orphans, wantOrphans) {
		t.Fatalf("orphans = %v, want %v", orphans, wantOrphans)
	}
	if !reflect.DeepEqual(shared, wantShared) {
		t.Fatalf("shared = %v, want %v", shared, wantShared)
	}
}

func TestClassifyNeuronsLettingGoSingleMemorySubset(t *testing.T) {
	t.Parallel()
	// Letting-go shape: one memory's semantic-neuron subset. n-sem-a is its alone → orphan; n-sem-b is
	// shared with a retained outside memory → kept.
	orphans, shared := ClassifyNeurons(
		[]string{"m1"},
		[]string{"n-sem-a", "n-sem-b"},
		[]NeuronActivationFact{
			{NeuronID: "n-sem-a", EpisodicMemoryID: "m1"},
			{NeuronID: "n-sem-b", EpisodicMemoryID: "m1"},
			{NeuronID: "n-sem-b", EpisodicMemoryID: "m2"},
		},
	)
	if !reflect.DeepEqual(orphans, []string{"n-sem-a"}) || !reflect.DeepEqual(shared, []string{"n-sem-b"}) {
		t.Fatalf("letting-go classify = (orphans %v, shared %v), want ([n-sem-a], [n-sem-b])", orphans, shared)
	}
}

func TestClassifyNeuronsIsDeterministicAndPreservesOrder(t *testing.T) {
	t.Parallel()
	neurons := []string{"n3", "n1", "n2"}
	facts := []NeuronActivationFact{
		{NeuronID: "n1", EpisodicMemoryID: "m2"},
		{NeuronID: "n3", EpisodicMemoryID: "m1"},
	}
	orphansA, sharedA := ClassifyNeurons([]string{"m1"}, neurons, facts)
	orphansB, sharedB := ClassifyNeurons([]string{"m1"}, neurons, facts)
	if !reflect.DeepEqual(orphansA, orphansB) || !reflect.DeepEqual(sharedA, sharedB) {
		t.Fatal("classification is not deterministic across re-runs")
	}
	// Input neuron order is preserved within each partition.
	if !reflect.DeepEqual(orphansA, []string{"n3", "n2"}) || !reflect.DeepEqual(sharedA, []string{"n1"}) {
		t.Fatalf("partitions = (orphans %v, shared %v), want ([n3 n2], [n1]) in input order", orphansA, sharedA)
	}
}

func TestClassifyNeuronsZeroOutsideActivationsAllOrphan(t *testing.T) {
	t.Parallel()
	orphans, shared := ClassifyNeurons(
		[]string{"m1"},
		[]string{"n1", "n2"},
		[]NeuronActivationFact{
			{NeuronID: "n1", EpisodicMemoryID: "m1"},
			{NeuronID: "n2", EpisodicMemoryID: "m1"},
		},
	)
	if len(shared) != 0 || !reflect.DeepEqual(orphans, []string{"n1", "n2"}) {
		t.Fatalf("all-inside removal = (orphans %v, shared %v), want both orphan", orphans, shared)
	}
}

func TestReclassifyRetainedNeuronSealsPreservesPermanentLetGo(t *testing.T) {
	t.Parallel()
	plan := ReclassifyRetainedNeuronSeals([]NeuronSealFact{
		{NeuronID: "unsealed", RepresentationRevision: 1},
		{
			NeuronID:               "release-owned",
			RepresentationRevision: 2,
			Sealed:                 true,
			HasReleaseEffect:       true,
			ReleaseOwnsCurrentSeal: true,
		},
		{
			NeuronID:               "let-go-replaced",
			RepresentationRevision: 3,
			Sealed:                 true,
			HasReleaseEffect:       true,
			ReleaseOwnsCurrentSeal: false,
		},
		{NeuronID: "let-go-only", RepresentationRevision: 4, Sealed: true},
	})

	if !reflect.DeepEqual(plan.RetireReleaseEffectIDs, []string{"release-owned", "let-go-replaced"}) {
		t.Fatalf("retired effects = %v", plan.RetireReleaseEffectIDs)
	}
	if !reflect.DeepEqual(plan.UnsealNeuronIDs, []string{"release-owned"}) {
		t.Fatalf("unsealed = %v, want only timestamp-owned release seal", plan.UnsealNeuronIDs)
	}
	wantReembed := []NeuronRevision{
		{NeuronID: "unsealed", RepresentationRevision: 1},
		{NeuronID: "release-owned", RepresentationRevision: 2},
	}
	if !reflect.DeepEqual(plan.Reembed, wantReembed) {
		t.Fatalf("reembed = %+v, want %+v", plan.Reembed, wantReembed)
	}
}
