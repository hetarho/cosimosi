package account

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

type fakeStore struct {
	stored map[string]string
	getErr error
	putErr error
}

func (f *fakeStore) GetPalettePreference(_ context.Context, scope platform.UserScope) (string, bool, error) {
	if f.getErr != nil {
		return "", false, f.getErr
	}
	id, ok := f.stored[scope.UserID()]
	return id, ok, nil
}

func (f *fakeStore) UpsertPalettePreference(_ context.Context, scope platform.UserScope, paletteID string) (string, error) {
	if f.putErr != nil {
		return "", f.putErr
	}
	if f.stored == nil {
		f.stored = map[string]string{}
	}
	f.stored[scope.UserID()] = paletteID
	return paletteID, nil
}

func newTestService(t *testing.T, store PreferenceStore) *Service {
	t.Helper()
	service, err := NewService(store)
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

func mustScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func TestNewServiceRequiresStore(t *testing.T) {
	t.Parallel()
	if _, err := NewService(nil); !errors.Is(err, ErrStoreRequired) {
		t.Fatalf("NewService(nil) err = %v, want ErrStoreRequired", err)
	}
}

func TestGetReturnsDefaultWhenUnset(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{})

	got, err := service.GetPalettePreference(context.Background(), mustScope(t, "u1"))
	if err != nil {
		t.Fatalf("GetPalettePreference failed: %v", err)
	}
	if got != DefaultPaletteID {
		t.Fatalf("unset get = %q, want %q", got, DefaultPaletteID)
	}
}

func TestSetThenGetRoundTrips(t *testing.T) {
	t.Parallel()
	store := &fakeStore{}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	set, err := service.SetPalettePreference(context.Background(), scope, "muted-dusk")
	if err != nil {
		t.Fatalf("SetPalettePreference failed: %v", err)
	}
	if set != "muted-dusk" {
		t.Fatalf("set echo = %q, want muted-dusk", set)
	}
	got, err := service.GetPalettePreference(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetPalettePreference failed: %v", err)
	}
	if got != "muted-dusk" {
		t.Fatalf("get after set = %q, want muted-dusk", got)
	}
}

func TestSetRejectsUnknownID(t *testing.T) {
	t.Parallel()
	store := &fakeStore{}
	service := newTestService(t, store)
	scope := mustScope(t, "u1")

	if _, err := service.SetPalettePreference(context.Background(), scope, "not-a-palette"); !errors.Is(err, ErrUnknownPaletteID) {
		t.Fatalf("set(unknown) err = %v, want ErrUnknownPaletteID", err)
	}
	if _, err := service.SetPalettePreference(context.Background(), scope, ""); !errors.Is(err, ErrUnknownPaletteID) {
		t.Fatalf("set(empty) err = %v, want ErrUnknownPaletteID", err)
	}
	if _, ok := store.stored["u1"]; ok {
		t.Fatal("a rejected write must not persist a preference")
	}
}

func TestGetCoercesUnknownStoredIDToDefault(t *testing.T) {
	t.Parallel()
	// A palette retired after the user chose it: the stored id is no longer in the registry.
	store := &fakeStore{stored: map[string]string{"u1": "retired-palette"}}
	service := newTestService(t, store)

	got, err := service.GetPalettePreference(context.Background(), mustScope(t, "u1"))
	if err != nil {
		t.Fatalf("GetPalettePreference failed: %v", err)
	}
	if got != DefaultPaletteID {
		t.Fatalf("unknown stored id get = %q, want default %q", got, DefaultPaletteID)
	}
}

func TestScopeRequired(t *testing.T) {
	t.Parallel()
	service := newTestService(t, &fakeStore{})
	var anonymous platform.UserScope

	if _, err := service.GetPalettePreference(context.Background(), anonymous); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("get(anonymous) err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.SetPalettePreference(context.Background(), anonymous, "cosimosi-default"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("set(anonymous) err = %v, want ErrScopeRequired", err)
	}
}

// The Go half of the id sync guard: the first-party allow-list must equal the shared id fixture
// that the client registry also mirrors. The fixture is byte-identical to
// packages/emotion/fixtures/palette-ids.json (the TS suite asserts its own half), so if a palette
// is added or removed without updating both, one of the two suites fails.
func TestRegistryAllowListMatchesFixture(t *testing.T) {
	t.Parallel()

	data, err := os.ReadFile("testdata/palette-ids.json")
	if err != nil {
		t.Fatalf("read id fixture: %v", err)
	}
	var fixture []string
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode id fixture: %v", err)
	}
	sort.Strings(fixture)

	allow := RegistryPaletteIDs()
	sort.Strings(allow)

	if len(fixture) != len(allow) {
		t.Fatalf("allow-list %v does not match fixture %v", allow, fixture)
	}
	for i := range fixture {
		if fixture[i] != allow[i] {
			t.Fatalf("allow-list %v does not match fixture %v", allow, fixture)
		}
	}
}
