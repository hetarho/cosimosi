package memory

import (
	"context"
	"errors"
	"testing"
)

func TestRecallSucceedsWithoutAnyEconomyCapability(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)
	fixture.launches.economy.spend = nil
	_, err := fixture.paid.Recall(context.Background(), testScope(t), RecallCommand{OperationID: "free", MemoryID: "m1", RewriteText: "remembered", SyncConsent: true})
	if err != nil {
		t.Fatal(err)
	}
	if fixture.predictionError.calls != 1 || len(fixture.launches.recall.anchorResets) != 1 {
		t.Fatal("free recall must still compare and reinforce")
	}
}

func TestRestoreMemoryTextChargesOnceAndNeverReconstructs(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	memory := recallableMemory()
	memory.ForgettingOffsetDays = 200
	fixture.seedRecallable("m1", memory, nil, nil)
	fixture.predictionError.err = errors.New("must not compare stored-text retrieval")
	cmd := RestoreMemoryTextCommand{OperationID: "restore", MemoryID: "m1", SyncConsent: true}
	first, err := fixture.paid.RestoreMemoryText(context.Background(), testScope(t), cmd)
	if err != nil {
		t.Fatal(err)
	}
	if first.Reconsolidated || first.CurrentText != memory.CurrentText || first.Seed != *memory.Seed || fixture.predictionError.calls != 0 {
		t.Fatalf("restoration changed the narrative or compared it: %+v", first)
	}
	if len(fixture.launches.recall.provenance) != 0 || len(fixture.launches.recall.reconText) != 0 {
		t.Fatal("restoration must not reconsolidate")
	}
	assertNeighborOffsets(t, fixture.launches.recall.offsets, map[string]float64{"m1": -200})
	second, err := fixture.paid.RestoreMemoryText(context.Background(), testScope(t), cmd)
	if err != nil || second.CurrentText != first.CurrentText || second.RecallCount != first.RecallCount || len(fixture.spendGate.intents) != 1 {
		t.Fatalf("restore replay: %+v / %v / %v", second, err, fixture.spendGate.intents)
	}
	_, err = fixture.paid.Recall(context.Background(), testScope(t), RecallCommand{OperationID: "restore", MemoryID: "m1", RewriteText: "another intent", SyncConsent: true})
	if !errors.Is(err, ErrOperationConflict) {
		t.Fatalf("free recall must not replay a restoration receipt: %v", err)
	}
}

func TestRestoreMemoryTextRequiresConsentAndLiveTargetBeforeSpend(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	previous := recallTestClock()
	fixture.launches.clock = &previous
	fixture.seedRecallable("m1", recallableMemory(), nil, nil)
	_, err := fixture.paid.RestoreMemoryText(context.Background(), testScope(t), RestoreMemoryTextCommand{OperationID: "restore", MemoryID: "m1"})
	if !errors.Is(err, ErrSyncConsentRequired) || len(fixture.spendGate.intents) != 0 {
		t.Fatalf("unconsented restoration: %v", err)
	}
	_, err = fixture.paid.RestoreMemoryText(context.Background(), testScope(t), RestoreMemoryTextCommand{OperationID: "restore", MemoryID: "missing", SyncConsent: true})
	if !errors.Is(err, ErrRecallMemoryNotFound) || len(fixture.spendGate.intents) != 0 || !fixture.launches.clock.Equal(previous) {
		t.Fatalf("missing target must not spend or advance: %v", err)
	}
}
