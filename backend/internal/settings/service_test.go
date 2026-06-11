package settings

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
)

// fakeRepo records the patch handed to Update so tests can assert "no write on
// invalid input" without a database.
type fakeRepo struct {
	stored   Settings
	captured *Patch
}

func (f *fakeRepo) Get(context.Context, string) (Settings, error) { return f.stored, nil }
func (f *fakeRepo) Update(_ context.Context, _ string, p Patch) error {
	f.captured = &p
	return nil
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

// 1.2 — a valid partial patch is forwarded and the merged result returned.
func TestUpdateValidPatchWrites(t *testing.T) {
	repo := &fakeRepo{stored: Settings{Theme: "calm"}}
	got, err := NewService(repo).Update(context.Background(), "u1", Patch{
		Theme:         ptr("calm"),
		EmotionColors: []EmotionColor{{Mood: "joy", Color: "#ffd64d"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.captured == nil {
		t.Fatal("expected repo.Update to be called")
	}
	if got.Theme != "calm" {
		t.Errorf("merged Theme = %q, want calm", got.Theme)
	}
}

// 1.3 — invalid values are rejected BEFORE any write (no partial application).
func TestUpdateRejectsInvalidBeforeWrite(t *testing.T) {
	cases := []struct {
		name string
		p    Patch
		want error
	}{
		{"non-hex color", Patch{EmotionColors: []EmotionColor{{Mood: "joy", Color: "red"}}}, ErrInvalidColor},
		{"short hex", Patch{EmotionColors: []EmotionColor{{Mood: "joy", Color: "#FFF"}}}, ErrInvalidColor},
		{"unknown theme", Patch{Theme: ptr("rainbow")}, ErrInvalidTheme},
		{"unknown object", Patch{StarObject: ptr("blob")}, ErrInvalidObject},
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

// 1.8 — both RPCs require an authenticated caller (no user id in context).
func TestHandlerRequiresAuth(t *testing.T) {
	h := NewHandler(NewService(&fakeRepo{}))
	ctx := context.Background()
	if _, err := h.GetSettings(ctx, connect.NewRequest(&cosimosiv1.GetSettingsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("GetSettings: want Unauthenticated, got %v", err)
	}
	if _, err := h.UpdateSettings(ctx, connect.NewRequest(&cosimosiv1.UpdateSettingsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("UpdateSettings: want Unauthenticated, got %v", err)
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
