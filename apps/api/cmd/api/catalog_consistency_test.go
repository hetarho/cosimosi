package main

import (
	"testing"

	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/store"
)

// The cross-catalog guards live here because the composition root is the one package that
// legitimately sees both catalogs (ARCHITECTURE §2.4): achievement never imports store or memory,
// so its ornament ids and family members are opaque strings there and 1:1 facts here.

// Every achievement-only ornament is paid by exactly one achievement, and every achievement
// ornament reward names an achievement-only ornament — 1:1 in both directions ([P11][A3]).
func TestAchievementOrnamentRewardsPairWithStoreCatalog(t *testing.T) {
	t.Parallel()
	rewarded := map[store.OrnamentID]string{}
	for _, row := range achievement.Catalog() {
		if row.Reward.OrnamentID == "" {
			continue
		}
		id := store.OrnamentID(row.Reward.OrnamentID)
		if previous, dup := rewarded[id]; dup {
			t.Fatalf("ornament %q is rewarded by both %q and %q", id, previous, row.ID)
		}
		rewarded[id] = row.ID
		ornament, published := store.LookupOrnament(id)
		if !published {
			t.Fatalf("%s rewards %q, which the store catalog does not publish", row.ID, id)
		}
		if ornament.Acquisition != store.AcquisitionAchievement {
			t.Fatalf("%s rewards %q, which is %s — not achievement-only", row.ID, id, ornament.Acquisition)
		}
	}
	for _, ornament := range store.Ornaments() {
		if ornament.Acquisition != store.AcquisitionAchievement {
			continue
		}
		if _, paid := rewarded[ornament.ID]; !paid {
			t.Fatalf("achievement-only ornament %q is unreachable: no achievement rewards it", ornament.ID)
		}
		delete(rewarded, ornament.ID)
	}
	if len(rewarded) != 0 {
		t.Fatalf("achievement rewards without a store row: %v", rewarded)
	}
}

// The mood_recorded family mirrors the product's mood vocabulary 1:1 — the drift guard, since
// achievement cannot import the mood list ([M2]).
func TestAchievementMoodFamilyMatchesMemoryMoods(t *testing.T) {
	t.Parallel()
	moods := memory.AllMoods()
	family := achievement.MoodRecordedFamily()
	if len(family) != len(moods) {
		t.Fatalf("mood family = %d members, memory moods = %d", len(family), len(moods))
	}
	for _, mood := range moods {
		key, ok := achievement.MoodRecordedCounterKey(string(mood))
		if !ok {
			t.Fatalf("mood %q has no mood_recorded key", mood)
		}
		if !achievement.KnownCounterKey(key) {
			t.Fatalf("mood key %q is not in the closed set", key)
		}
	}
}

// The ornament_kind_decorated family mirrors store's DECLARED closed OrnamentKind set 1:1 — the
// declaration, not the kinds the catalog happens to have rows for. A kind added to the enum with no
// ornament yet is exactly the case a derived set would wave through, and the first save that changed
// it would push a counter key nothing knows.
func TestAchievementOrnamentKindFamilyMatchesStoreKinds(t *testing.T) {
	t.Parallel()
	kinds := store.AllOrnamentKinds()
	family := achievement.OrnamentKindDecoratedFamily()
	if len(family) != len(kinds) {
		t.Fatalf("ornament kind family = %d members, store kinds = %d", len(family), len(kinds))
	}
	for _, kind := range kinds {
		key, ok := achievement.OrnamentKindDecoratedCounterKey(string(kind))
		if !ok {
			t.Fatalf("store kind %q has no ornament_kind_decorated key", kind)
		}
		if !achievement.KnownCounterKey(key) {
			t.Fatalf("kind key %q is not in the closed set", key)
		}
	}
}

// The producer drift guard, and the reason this file exists: a producing context cannot import
// achievement's constants, so its own key constants are plain strings that nothing checks — until
// here. `store` already declares and pushes three of them, so renaming a key on either side is a
// failure now rather than a `ErrUnknownCounterKey` on the first real save after a recorder is bound
// (the no-op recorder keeps that dormant, which is what makes the drift silent).
func TestProducerCounterKeysAreMembersOfTheClosedSet(t *testing.T) {
	t.Parallel()
	producerKeys := []string{
		store.CounterDecorationSaved,
		store.CounterOrnamentOwned,
	}
	for _, kind := range store.AllOrnamentKinds() {
		producerKeys = append(producerKeys, store.CounterOrnamentKindDecorated(kind))
	}
	for _, key := range producerKeys {
		if !achievement.KnownCounterKey(achievement.CounterKey(key)) {
			t.Fatalf("producer pushes %q, which is not in the achievement closed set", key)
		}
	}
	// The modes have to agree too: `store` reports ornament_owned as a count of what is owned AFTER
	// the save, which is only a fact if the counter keeps a high-water mark rather than summing.
	if mode, _ := achievement.CounterModeOf(achievement.CounterKey(store.CounterOrnamentOwned)); mode != achievement.CounterModeReach {
		t.Fatalf("ornament_owned mode = %q, want reach — a producer reporting a total must not be summed", mode)
	}
	if mode, _ := achievement.CounterModeOf(achievement.CounterKey(store.CounterDecorationSaved)); mode != achievement.CounterModeAccumulate {
		t.Fatalf("decoration_saved mode = %q, want accumulate", mode)
	}
}

// Every counter a catalog condition reads is a member of the closed set with a resolved mode.
func TestCatalogCountersAreMembersOfTheClosedSet(t *testing.T) {
	t.Parallel()
	for _, row := range achievement.Catalog() {
		if !achievement.KnownCounterKey(row.Condition.Counter) {
			t.Fatalf("%s reads %q, which is not in the closed set", row.ID, row.Condition.Counter)
		}
		if _, ok := achievement.CounterModeOf(row.Condition.Counter); !ok {
			t.Fatalf("%s reads %q, which has no accumulation mode", row.ID, row.Condition.Counter)
		}
	}
}
