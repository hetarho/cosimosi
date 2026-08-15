package store_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/store"
)

// The Go half of the catalog↔registry drift guard: the same fixture the renderer package asserts its
// two registries against. A renamed or dropped registry key therefore fails a test on both runtimes.
// The lists' lengths are read, never asserted as numbers — membership is a rule, not a count.
type ornamentIDFixture struct {
	Defaults map[string]string   `json:"defaults"`
	IDs      map[string][]string `json:"ids"`
}

func readOrnamentIDFixture(t *testing.T) ornamentIDFixture {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "ornament-ids.json"))
	if err != nil {
		t.Fatalf("read ornament id fixture: %v", err)
	}
	var fixture ornamentIDFixture
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("parse ornament id fixture: %v", err)
	}
	return fixture
}

func catalogIDsByKind(t *testing.T) map[store.OrnamentKind][]string {
	t.Helper()
	byKind := map[store.OrnamentKind][]string{}
	// Seeded from the DECLARED set, so a kind with no rows yet still shows up as an empty list the
	// fixture has to agree with, instead of vanishing from the comparison.
	for _, kind := range store.AllOrnamentKinds() {
		byKind[kind] = nil
	}
	for _, ornament := range store.Ornaments() {
		byKind[ornament.Kind] = append(byKind[ornament.Kind], string(ornament.ID))
	}
	for kind := range byKind {
		slices.Sort(byKind[kind])
	}
	return byKind
}

func TestCatalogMatchesTheRendererIDFixture(t *testing.T) {
	t.Parallel()
	fixture := readOrnamentIDFixture(t)
	byKind := catalogIDsByKind(t)
	if len(fixture.IDs) != len(byKind) {
		t.Fatalf("fixture kinds = %v, catalog kinds = %v", fixture.IDs, byKind)
	}
	for kind, ids := range byKind {
		want, ok := fixture.IDs[string(kind)]
		if !ok {
			t.Fatalf("fixture has no ids for kind %q", kind)
		}
		if !slices.Equal(ids, want) {
			t.Errorf("%s ids = %v, want %v", kind, ids, want)
		}
	}
	for kind, want := range fixture.Defaults {
		got, ok := store.DefaultOrnamentID(store.OrnamentKind(kind))
		if !ok || string(got) != want {
			t.Errorf("default for %s = %q (found %v), want %q", kind, got, ok, want)
		}
	}
}

func TestCatalogRowsCarryTheirKindPrefixAndNothingElse(t *testing.T) {
	t.Parallel()
	for _, ornament := range store.Ornaments() {
		prefix := strings.ToLower(string(ornament.Kind)) + "."
		if !strings.HasPrefix(string(ornament.ID), prefix) || len(ornament.ID) == len(prefix) {
			t.Errorf("id %q does not carry its kind prefix %q", ornament.ID, prefix)
		}
		if _, ok := store.LookupOrnament(ornament.ID); !ok {
			t.Errorf("enumerated row %q does not resolve by id", ornament.ID)
		}
	}
}

// One free row per kind, and it is that kind's default — which is what lets the free entry point be
// the ABSENCE of a selection row instead of a signup grant ([P10]).
func TestEveryKindHasExactlyOneFreeRowAndItIsTheDefault(t *testing.T) {
	t.Parallel()
	free := map[store.OrnamentKind][]store.OrnamentID{}
	for _, ornament := range store.Ornaments() {
		if ornament.Acquisition == store.AcquisitionFree {
			free[ornament.Kind] = append(free[ornament.Kind], ornament.ID)
		}
	}
	for _, kind := range store.AllOrnamentKinds() {
		ids := free[kind]
		if len(ids) != 1 {
			t.Fatalf("%s free rows = %v, want exactly one", kind, ids)
		}
		want, _ := store.DefaultOrnamentID(kind)
		if ids[0] != want {
			t.Errorf("%s free row = %q, want the default %q", kind, ids[0], want)
		}
	}
}

// [P11] 아주 가끔: exactly two rows are achievement-only, at most one in any kind, so the pairing
// with the two ornament capstones is 1:1. Two, not one per kind: an achievement-only row exists
// because a capstone pays it, so most kinds have none and no kind may have two.
func TestExactlyTwoAchievementRowsWithAtMostOnePerKind(t *testing.T) {
	t.Parallel()
	byKind := map[store.OrnamentKind][]store.OrnamentID{}
	for _, ornament := range store.Ornaments() {
		if ornament.Acquisition == store.AcquisitionAchievement {
			byKind[ornament.Kind] = append(byKind[ornament.Kind], ornament.ID)
		}
	}
	if len(byKind) != 2 {
		t.Fatalf("achievement rows by kind = %v, want one kind each", byKind)
	}
	for kind, ids := range byKind {
		if len(ids) != 1 {
			t.Errorf("%s achievement rows = %v, want exactly one", kind, ids)
		}
	}
}

func TestPriceResolvesByKindAndOnlyForPurchasableRows(t *testing.T) {
	t.Parallel()
	wantPrice := map[store.OrnamentKind]int{
		store.KindBackground: values.StoreBackgroundPrice,
		store.KindStarShader: values.StoreStarShaderPrice,
		store.KindGistShader: values.StoreGistShaderPrice,
		store.KindMote:       values.StoreMotePrice,
		store.KindMoteField:  values.StoreMoteFieldPrice,
	}
	if len(wantPrice) != len(store.AllOrnamentKinds()) {
		t.Fatalf("priced kinds = %d, declared kinds = %d", len(wantPrice), len(store.AllOrnamentKinds()))
	}
	for _, ornament := range store.Ornaments() {
		want := 0
		if ornament.Acquisition == store.AcquisitionPurchase {
			want = wantPrice[ornament.Kind]
		}
		if got := store.PriceOf(ornament); got != want {
			t.Errorf("price of %q (%s) = %d, want %d", ornament.ID, ornament.Acquisition, got, want)
		}
	}
}

func TestRequirePurchasableRefusesUnknownFreeAndAchievementRows(t *testing.T) {
	t.Parallel()
	if _, err := store.RequirePurchasable("background.no-such-sky"); !errors.Is(err, store.ErrUnknownOrnamentID) {
		t.Errorf("unknown id err = %v, want ErrUnknownOrnamentID", err)
	}
	if _, err := store.RequirePurchasable(store.DefaultBackgroundOrnamentID); !errors.Is(err, store.ErrOrnamentNotPurchasable) {
		t.Errorf("free row err = %v, want ErrOrnamentNotPurchasable", err)
	}
	if _, err := store.RequirePurchasable("star_shader.spire"); !errors.Is(err, store.ErrOrnamentNotPurchasable) {
		t.Errorf("achievement row err = %v, want ErrOrnamentNotPurchasable", err)
	}
	if _, err := store.RequirePurchasable("background.grainstorm"); err != nil {
		t.Errorf("purchasable row err = %v, want nil", err)
	}
}
