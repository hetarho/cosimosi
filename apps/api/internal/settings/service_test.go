package settings

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
)

// fakeRepo records the patch handed to Update so tests can assert "no write on invalid input"
// without a database, and serves a fixed inventory for the ownership checks (spec 44).
type fakeRepo struct {
	stored   Settings
	captured *Patch
	inv      Inventory // returned by GetInventory (owned set + balance for ownership checks)
	bought   *string   // item id passed to Purchase, if called
}

func (f *fakeRepo) Get(context.Context, string) (Settings, error) { return f.stored, nil }
func (f *fakeRepo) Update(_ context.Context, _ string, p Patch) error {
	f.captured = &p
	return nil
}
func (f *fakeRepo) GetInventory(_ context.Context, _ string, starting int) (Inventory, error) {
	if f.inv.Stardust == 0 && len(f.inv.OwnedItemIDs) == 0 {
		return Inventory{Stardust: starting}, nil // never-seeded → starting balance, nothing owned
	}
	return f.inv, nil
}
func (f *fakeRepo) ListOwned(_ context.Context, _ string) ([]string, error) {
	return f.inv.OwnedItemIDs, nil
}
func (f *fakeRepo) Purchase(_ context.Context, _, itemID string, _, _ int) (Inventory, error) {
	f.bought = &itemID
	return f.inv, nil
}

func ptr(s string) *string { return &s }

// 1.1 — no stored overrides → empty Settings (the client merges its defaults).
func TestGetEmpty(t *testing.T) {
	got, err := NewService(&fakeRepo{}).Get(context.Background(), "u1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Theme != "" || got.StarObject != "" || len(got.EmotionColors) != 0 {
		t.Errorf("expected empty overrides, got %+v", got)
	}
}

// 1.2 — a valid partial patch (a FREE axis kind needs no ownership) is forwarded.
func TestUpdateValidPatchWrites(t *testing.T) {
	repo := &fakeRepo{stored: Settings{Theme: "galaxy"}}
	got, err := NewService(repo).Update(context.Background(), "u1", Patch{
		Theme:         ptr("galaxy"), // free background — selectable without ownership
		EmotionColors: []EmotionColor{{Mood: "joy", Color: "#ffd64d"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.captured == nil {
		t.Fatal("expected repo.Update to be called")
	}
	if got.Theme != "galaxy" {
		t.Errorf("merged Theme = %q, want galaxy", got.Theme)
	}
}

// A4 — an owned paid star look (change 29: single-axis) is selectable; the patch is forwarded.
func TestUpdateOwnedPaidWrites(t *testing.T) {
	repo := &fakeRepo{inv: Inventory{Stardust: 70, OwnedItemIDs: []string{"star:look:spiky"}}}
	_, err := NewService(repo).Update(context.Background(), "u1", Patch{StarObject: ptr("spiky")})
	if err != nil {
		t.Fatalf("owned star look should be selectable, got %v", err)
	}
	if repo.captured == nil {
		t.Fatal("expected repo.Update to be called for an owned star look")
	}
}

// A5 — self/synapse composite needs BOTH sub-items owned-or-free: a half-owned composite is rejected,
// and an all-free composite (orb+mirror) needs no ownership round-trip (spec 52). Star is single-axis
// (change 29): a free look (polyhedron) is selectable with nothing owned.
func TestUpdateCompositeOwnership(t *testing.T) {
	// self cube(paid) owned but surface prism(paid) NOT owned → rejected before any write.
	half := &fakeRepo{inv: Inventory{Stardust: 70, OwnedItemIDs: []string{"self:form:cube"}}}
	if _, err := NewService(half).Update(context.Background(), "u1", Patch{SelfObject: ptr("cube+prism")}); !errors.Is(err, ErrNotOwned) {
		t.Errorf("half-owned composite: want ErrNotOwned, got %v", err)
	}
	if half.captured != nil {
		t.Error("repo.Update must not run for a half-owned composite")
	}
	// free star look (default) → selectable with nothing owned.
	free := &fakeRepo{}
	if _, err := NewService(free).Update(context.Background(), "u1", Patch{StarObject: ptr("polyhedron")}); err != nil {
		t.Errorf("free star look should be selectable, got %v", err)
	}
	if free.captured == nil {
		t.Error("expected repo.Update for a free star look")
	}
}

// change 30 / A3·A4 — per-emotion star FORM override mirrors emotion colors: a partial upsert (only
// the moods sent, never deleting others) gated by the SAME "star:look:<id>" ownership rule as the
// global star axis. A free look needs no ownership; an owned paid look is allowed; an unowned or
// unknown look is rejected before any write.
func TestUpdateEmotionForms(t *testing.T) {
	// free look (polyhedron) assigned to a mood → allowed with nothing owned; the patch is forwarded.
	free := &fakeRepo{}
	if _, err := NewService(free).Update(context.Background(), "u1", Patch{
		EmotionForms: []EmotionForm{{Mood: "joy", Look: "polyhedron"}},
	}); err != nil {
		t.Errorf("free look override should be allowed, got %v", err)
	}
	if free.captured == nil || len(free.captured.EmotionForms) != 1 {
		t.Errorf("expected the emotion-form patch forwarded, got %+v", free.captured)
	}

	// owned paid look (spiky) assigned to a mood → allowed (look is owned even at zero balance).
	owned := &fakeRepo{inv: Inventory{OwnedItemIDs: []string{"star:look:spiky"}}}
	if _, err := NewService(owned).Update(context.Background(), "u1", Patch{
		EmotionForms: []EmotionForm{{Mood: "sad", Look: "spiky"}},
	}); err != nil {
		t.Errorf("owned look override should be allowed, got %v", err)
	}

	// unowned paid look (liquid) assigned to a mood → ErrNotOwned, no write (A4).
	locked := &fakeRepo{}
	if _, err := NewService(locked).Update(context.Background(), "u1", Patch{
		EmotionForms: []EmotionForm{{Mood: "joy", Look: "liquid"}},
	}); !errors.Is(err, ErrNotOwned) {
		t.Errorf("unowned look override: want ErrNotOwned, got %v", err)
	}
	if locked.captured != nil {
		t.Error("repo.Update must not run for an unowned look override")
	}

	// unknown look id → ErrUnknownItem, no write.
	bad := &fakeRepo{}
	if _, err := NewService(bad).Update(context.Background(), "u1", Patch{
		EmotionForms: []EmotionForm{{Mood: "joy", Look: "blob"}},
	}); !errors.Is(err, ErrUnknownItem) {
		t.Errorf("unknown look override: want ErrUnknownItem, got %v", err)
	}
	if bad.captured != nil {
		t.Error("repo.Update must not run for an unknown look override")
	}
}

// 1.3 / A4 — invalid or locked selections are rejected BEFORE any write (no partial application).
func TestUpdateRejectsInvalidBeforeWrite(t *testing.T) {
	cases := []struct {
		name string
		p    Patch
		want error
	}{
		{"non-hex color", Patch{EmotionColors: []EmotionColor{{Mood: "joy", Color: "red"}}}, ErrInvalidColor},
		{"short hex", Patch{EmotionColors: []EmotionColor{{Mood: "joy", Color: "#FFF"}}}, ErrInvalidColor},
		{"unknown background", Patch{Theme: ptr("rainbow")}, ErrUnknownItem},
		// star is a single-axis look (change 29); self/synapse stay composite "<form>+<surface>".
		{"unknown star look", Patch{StarObject: ptr("blob")}, ErrUnknownItem},
		{"legacy composite star id (tampered)", Patch{StarObject: ptr("lowpoly+facet")}, ErrUnknownItem},
		{"unknown synapse form", Patch{SynapseStyle: ptr("zigzag+flow")}, ErrUnknownItem},
		{"legacy star object id", Patch{StarObject: ptr("deepfield")}, ErrUnknownItem},
		{"removed self core", Patch{SelfObject: ptr("core+mirror")}, ErrUnknownItem},
		{"locked paid background", Patch{Theme: ptr("vortex")}, ErrNotOwned}, // known paid, not owned
		// known paid items not owned → NotOwned (not Unknown).
		{"locked paid star look", Patch{StarObject: ptr("liquid")}, ErrNotOwned},
		{"new paid self", Patch{SelfObject: ptr("cube+prism")}, ErrNotOwned},
		{"new paid synapse", Patch{SynapseStyle: ptr("branched+beads")}, ErrNotOwned},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{}
			_, err := NewService(repo).Update(context.Background(), "u1", tc.p)
			if !errors.Is(err, tc.want) {
				t.Errorf("want %v, got %v", tc.want, err)
			}
			if repo.captured != nil {
				t.Error("repo.Update must not run when validation fails (no partial write)")
			}
		})
	}
}

// spec 52 — a legacy paid purchase still unlocks the skin after the form×surface split (no rebuy):
// owning "self:prism-cube" must satisfy the composite "cube+prism", and GetInventory reports the
// expanded sub-items so the FE pickers show them owned (no double-charge). (Star has no legacy
// purchases — change 29 collapsed it to a single look before launch.)
func TestLegacyOwnershipHonored(t *testing.T) {
	repo := &fakeRepo{inv: Inventory{Stardust: 0, OwnedItemIDs: []string{"self:prism-cube"}}}
	if _, err := NewService(repo).Update(context.Background(), "u1", Patch{SelfObject: ptr("cube+prism")}); err != nil {
		t.Errorf("legacy self:prism-cube should unlock cube+prism, got %v", err)
	}
	inv, err := NewService(repo).GetInventory(context.Background(), "u1")
	if err != nil {
		t.Fatalf("GetInventory: %v", err)
	}
	got := map[string]bool{}
	for _, id := range inv.OwnedItemIDs {
		got[id] = true
	}
	if !got["self:prism-cube"] || !got["self:form:cube"] || !got["self:surface:prism"] {
		t.Errorf("expanded inventory missing legacy/sub ids: %v", inv.OwnedItemIDs)
	}
}

// A2a — PurchaseItem rejects an unknown id and a free kind BEFORE touching the repository.
func TestPurchaseRejectsUnknownAndFree(t *testing.T) {
	cases := []struct {
		name   string
		itemID string
		want   error
	}{
		{"unknown", "star:does-not-exist", ErrUnknownItem},
		// free sub-items (slot defaults) are implicit ownership, not purchasable.
		{"free star look", "star:look:polyhedron", ErrItemFree},
		{"free self form", "self:form:orb", ErrItemFree},
		{"free synapse surface", "synapse:surface:flow", ErrItemFree},
		// legacy/removed single ids are no longer known.
		{"removed paid self core", "self:core", ErrUnknownItem},
		{"removed paid synapse beam", "synapse:beam", ErrUnknownItem},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeRepo{}
			_, err := NewService(repo).PurchaseItem(context.Background(), "u1", tc.itemID)
			if !errors.Is(err, tc.want) {
				t.Errorf("want %v, got %v", tc.want, err)
			}
			if repo.bought != nil {
				t.Error("repo.Purchase must not run for an unknown/free item")
			}
		})
	}
}

// A2 — a known paid sub-item is forwarded to the repository for the atomic debit+grant.
func TestPurchasePaidDelegates(t *testing.T) {
	repo := &fakeRepo{inv: Inventory{Stardust: 70}}
	if _, err := NewService(repo).PurchaseItem(context.Background(), "u1", "star:look:liquid"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.bought == nil || *repo.bought != "star:look:liquid" {
		t.Errorf("expected Purchase(star:look:liquid), got %v", repo.bought)
	}
}

// 1.8 / A15 — all RPCs require an authenticated caller (no user id in context).
func TestHandlerRequiresAuth(t *testing.T) {
	h := NewHandler(NewService(&fakeRepo{}))
	ctx := context.Background()
	if _, err := h.GetSettings(ctx, connect.NewRequest(&cosimosiv1.GetSettingsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("GetSettings: want Unauthenticated, got %v", err)
	}
	if _, err := h.UpdateSettings(ctx, connect.NewRequest(&cosimosiv1.UpdateSettingsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("UpdateSettings: want Unauthenticated, got %v", err)
	}
	if _, err := h.GetInventory(ctx, connect.NewRequest(&cosimosiv1.GetInventoryRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("GetInventory: want Unauthenticated, got %v", err)
	}
	if _, err := h.PurchaseItem(ctx, connect.NewRequest(&cosimosiv1.PurchaseItemRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("PurchaseItem: want Unauthenticated, got %v", err)
	}
}

// 1.3 (mood) — moodKey rejects UNSPECIFIED/out-of-range, lowercases the 13 valid moods.
func TestMoodKey(t *testing.T) {
	if _, ok := moodKey(cosimosiv1.Mood_MOOD_UNSPECIFIED); ok {
		t.Error("UNSPECIFIED must be rejected")
	}
	if _, ok := moodKey(cosimosiv1.Mood(999)); ok {
		t.Error("out-of-range enum value must be rejected")
	}
	if k, ok := moodKey(cosimosiv1.Mood_TIRED); !ok || k != "tired" {
		t.Errorf("TIRED → (%q, %v); want (tired, true)", k, ok)
	}
}
