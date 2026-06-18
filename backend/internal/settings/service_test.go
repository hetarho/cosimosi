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
	repo := &fakeRepo{stored: Settings{Theme: "vast"}}
	got, err := NewService(repo).Update(context.Background(), "u1", Patch{
		Theme:         ptr("vast"), // free background — selectable without ownership
		EmotionColors: []EmotionColor{{Mood: "joy", Color: "#ffd64d"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.captured == nil {
		t.Fatal("expected repo.Update to be called")
	}
	if got.Theme != "vast" {
		t.Errorf("merged Theme = %q, want vast", got.Theme)
	}
}

// A4 — an OWNED paid item is selectable; the patch is forwarded.
func TestUpdateOwnedPaidWrites(t *testing.T) {
	repo := &fakeRepo{inv: Inventory{Stardust: 70, OwnedItemIDs: []string{"star:aurora"}}}
	_, err := NewService(repo).Update(context.Background(), "u1", Patch{StarObject: ptr("aurora")})
	if err != nil {
		t.Fatalf("owned paid item should be selectable, got %v", err)
	}
	if repo.captured == nil {
		t.Fatal("expected repo.Update to be called for an owned item")
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
		{"unknown object", Patch{StarObject: ptr("blob")}, ErrUnknownItem},
		{"unknown synapse", Patch{SynapseStyle: ptr("zigzag")}, ErrUnknownItem},
		{"locked paid background", Patch{Theme: ptr("aurora-veil")}, ErrNotOwned}, // known paid, not owned
		{"locked paid object", Patch{StarObject: ptr("ember")}, ErrNotOwned},
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

// A2a — PurchaseItem rejects an unknown id and a free kind BEFORE touching the repository.
func TestPurchaseRejectsUnknownAndFree(t *testing.T) {
	cases := []struct {
		name   string
		itemID string
		want   error
	}{
		{"unknown", "star:does-not-exist", ErrUnknownItem},
		{"free kind", "star:deepfield", ErrItemFree},
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

// A2 — a known paid item is forwarded to the repository for the atomic debit+grant.
func TestPurchasePaidDelegates(t *testing.T) {
	repo := &fakeRepo{inv: Inventory{Stardust: 70, OwnedItemIDs: []string{"star:aurora"}}}
	if _, err := NewService(repo).PurchaseItem(context.Background(), "u1", "star:aurora"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.bought == nil || *repo.bought != "star:aurora" {
		t.Errorf("expected Purchase(star:aurora), got %v", repo.bought)
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
