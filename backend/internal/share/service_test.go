package share

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"
)

// fakeRepo is an in-memory Repository modeling the universe_shares table + landscape reads.
type fakeRepo struct {
	byUser map[string]Settings // user_id → row
	stars  map[string][]StarLandscape
	syn    map[string][]SynapseLandscape
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		byUser: map[string]Settings{},
		stars:  map[string][]StarLandscape{},
		syn:    map[string][]SynapseLandscape{},
	}
}

func (f *fakeRepo) GetByUser(_ context.Context, userID string) (Settings, bool, error) {
	st, ok := f.byUser[userID]
	return st, ok, nil
}

func (f *fakeRepo) Upsert(_ context.Context, userID, slug string, enabled bool, displayName string) (Settings, error) {
	if cur, ok := f.byUser[userID]; ok {
		slug = cur.Slug // existing row preserves its slug (rotation only)
	}
	st := Settings{Enabled: enabled, Slug: slug, DisplayName: displayName}
	f.byUser[userID] = st
	return st, nil
}

func (f *fakeRepo) Rotate(_ context.Context, userID, slug string) (Settings, bool, error) {
	cur, ok := f.byUser[userID]
	if !ok {
		return Settings{}, false, nil
	}
	cur.Slug = slug
	f.byUser[userID] = cur
	return cur, true, nil
}

func (f *fakeRepo) UserBySlug(_ context.Context, slug string) (string, string, bool, error) {
	for uid, st := range f.byUser {
		if st.Slug == slug && st.Enabled {
			return uid, st.DisplayName, true, nil
		}
	}
	return "", "", false, nil
}

// ListStars mirrors the production query's ORDER BY m.id (a FAITHFUL fake: the bridge/snapshot index
// parity hinges on this ordering, so the fake sorts rather than leaning on insertion order — that
// way the tests exercise the sort, not a pre-sorted fixture).
func (f *fakeRepo) ListStars(_ context.Context, userID string) ([]StarLandscape, error) {
	out := append([]StarLandscape(nil), f.stars[userID]...)
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

// ListStarIDs shares ListStars' ORDER BY m.id (the share.sql invariant) so the bridge index lines up
// with the snapshot array — derived from the SAME sorted ids.
func (f *fakeRepo) ListStarIDs(_ context.Context, userID string) ([]string, error) {
	ids := make([]string, 0, len(f.stars[userID]))
	for _, s := range f.stars[userID] {
		ids = append(ids, s.ID)
	}
	sort.Strings(ids)
	return ids, nil
}

func (f *fakeRepo) ListSynapses(_ context.Context, userID string) ([]SynapseLandscape, error) {
	return f.syn[userID], nil
}

type fakeSettings struct {
	appearance Appearance
	err        error
}

func (f fakeSettings) Appearance(context.Context, string) (Appearance, error) {
	return f.appearance, f.err
}

// fakeResonance models the gift context's caller↔owner resonance lookup, keyed "caller|owner".
// An absent key returns nil — exactly what a non-party caller (or no resonance yet) yields.
type fakeResonance struct {
	pairs map[string][]ResonancePair
}

func (f fakeResonance) ResonancesBetween(_ context.Context, caller, owner string) ([]ResonancePair, error) {
	return f.pairs[caller+"|"+owner], nil
}

func newService(repo Repository) *Service {
	return NewService(repo, fakeSettings{appearance: Appearance{Theme: "calm"}}, fakeResonance{})
}

// 1.4: the first enable mints a 128-bit (22-char base64url) slug; toggling off→on keeps it.
func TestUpdateSettings_FirstEnableMintsStableSlug(t *testing.T) {
	repo := newFakeRepo()
	svc := newService(repo)
	ctx := context.Background()

	st, err := svc.UpdateSettings(ctx, "u1", true, "내 우주")
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	if !st.Enabled {
		t.Fatal("want enabled")
	}
	if len(st.Slug) != 22 {
		t.Fatalf("want 22-char slug (128-bit base64url), got %q (len %d)", st.Slug, len(st.Slug))
	}
	first := st.Slug

	off, err := svc.UpdateSettings(ctx, "u1", false, "내 우주")
	if err != nil {
		t.Fatalf("disable: %v", err)
	}
	if off.Enabled || off.Slug != first {
		t.Fatalf("toggling off must keep the slug: got enabled=%v slug=%q", off.Enabled, off.Slug)
	}
	on, err := svc.UpdateSettings(ctx, "u1", true, "내 우주2")
	if err != nil {
		t.Fatalf("re-enable: %v", err)
	}
	if on.Slug != first {
		t.Fatalf("re-enable must reuse the slug (rotation is the only change): %q != %q", on.Slug, first)
	}
}

func TestUpdateSettings_DisplayNameTooLong(t *testing.T) {
	svc := newService(newFakeRepo())
	long := make([]rune, maxDisplayNameRunes+1)
	for i := range long {
		long[i] = 'x'
	}
	if _, err := svc.UpdateSettings(context.Background(), "u1", true, string(long)); !errors.Is(err, ErrDisplayNameTooLong) {
		t.Fatalf("want ErrDisplayNameTooLong, got %v", err)
	}
}

// 1.3: rotating issues a new slug and the OLD slug immediately stops resolving.
func TestRotateSlug_InvalidatesOldURL(t *testing.T) {
	repo := newFakeRepo()
	svc := newService(repo)
	ctx := context.Background()

	st, err := svc.UpdateSettings(ctx, "u1", true, "u")
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	old := st.Slug
	if _, err := svc.Snapshot(ctx, old); err != nil {
		t.Fatalf("old slug should resolve before rotate: %v", err)
	}

	rot, err := svc.RotateSlug(ctx, "u1")
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if rot.Slug == old {
		t.Fatal("rotate must change the slug")
	}
	if _, err := svc.Snapshot(ctx, old); !errors.Is(err, ErrNotFound) {
		t.Fatalf("old slug must be NotFound after rotate, got %v", err)
	}
	if _, err := svc.Snapshot(ctx, rot.Slug); err != nil {
		t.Fatalf("new slug must resolve: %v", err)
	}
}

func TestRotateSlug_NotSharedYet(t *testing.T) {
	svc := newService(newFakeRepo())
	if _, err := svc.RotateSlug(context.Background(), "ghost"); !errors.Is(err, ErrNotShared) {
		t.Fatalf("want ErrNotShared, got %v", err)
	}
}

// 1.2: a disabled share and an unknown slug return the SAME (uniform) NotFound — existence is
// not distinguishable.
func TestSnapshot_DisabledAndUnknownAreIndistinguishable(t *testing.T) {
	repo := newFakeRepo()
	svc := newService(repo)
	ctx := context.Background()

	st, err := svc.UpdateSettings(ctx, "u1", false, "u") // created but disabled
	if err != nil {
		t.Fatalf("create disabled: %v", err)
	}
	disabledErr := errSnapshot(t, svc, st.Slug)
	unknownErr := errSnapshot(t, svc, "this-slug-never-existed")
	if !errors.Is(disabledErr, ErrNotFound) || !errors.Is(unknownErr, ErrNotFound) {
		t.Fatalf("both must be ErrNotFound: disabled=%v unknown=%v", disabledErr, unknownErr)
	}
}

// 1.1 / 설계 요점: timestamps collapse to UTC day granularity (time-of-day dropped); two stars on
// the same UTC day share a CreatedDay, the next day is +1.
func TestSnapshot_QuantizesTimestampsToDay(t *testing.T) {
	repo := newFakeRepo()
	svc := newService(repo)
	ctx := context.Background()

	day0 := time.Date(2026, 6, 15, 0, 1, 0, 0, time.UTC)
	day0Late := time.Date(2026, 6, 15, 23, 59, 0, 0, time.UTC)
	day1 := time.Date(2026, 6, 16, 0, 1, 0, 0, time.UTC)
	repo.stars["u1"] = []StarLandscape{
		{ID: "a", Mood: "joy", Intensity: 0.7, CreatedAt: day0, LastRecalledAt: day0Late},
		{ID: "b", Mood: "calm", Intensity: 0.3, CreatedAt: day1, LastRecalledAt: day1},
	}
	st, err := svc.UpdateSettings(ctx, "u1", true, "u")
	if err != nil {
		t.Fatalf("enable: %v", err)
	}
	snap, err := svc.Snapshot(ctx, st.Slug)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if len(snap.Stars) != 2 {
		t.Fatalf("want 2 stars, got %d", len(snap.Stars))
	}
	// Same UTC day → identical CreatedDay/LastRecalledDay despite different time-of-day.
	if snap.Stars[0].CreatedDay != snap.Stars[0].LastRecalledDay {
		t.Fatalf("00:01 and 23:59 of the same day must quantize equal: %d vs %d",
			snap.Stars[0].CreatedDay, snap.Stars[0].LastRecalledDay)
	}
	if snap.Stars[1].CreatedDay != snap.Stars[0].CreatedDay+1 {
		t.Fatalf("next UTC day must be +1: %d vs %d", snap.Stars[1].CreatedDay, snap.Stars[0].CreatedDay)
	}
}

// Synapse endpoints map to snapshot-array indices; an edge whose endpoint isn't in the star set
// is dropped (never leaks a stray id).
func TestSnapshot_SynapseEndpointsMappedToIndices(t *testing.T) {
	repo := newFakeRepo()
	svc := newService(repo)
	ctx := context.Background()

	repo.stars["u1"] = []StarLandscape{{ID: "a"}, {ID: "b"}, {ID: "c"}}
	repo.syn["u1"] = []SynapseLandscape{
		{AID: "a", BID: "c", Weight: 0.5},
		{AID: "b", BID: "ghost", Weight: 0.9}, // endpoint not in the star set → dropped
	}
	st, _ := svc.UpdateSettings(ctx, "u1", true, "u")
	snap, err := svc.Snapshot(ctx, st.Slug)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if len(snap.Synapses) != 1 {
		t.Fatalf("the orphan-endpoint edge must be dropped: got %d synapses", len(snap.Synapses))
	}
	if snap.Synapses[0].A != 0 || snap.Synapses[0].B != 2 {
		t.Fatalf("a→0, c→2 expected, got A=%d B=%d", snap.Synapses[0].A, snap.Synapses[0].B)
	}
}

// Appearance is best-effort: a settings read failure degrades to the default rather than failing
// the snapshot (the landscape graph still renders).
func TestSnapshot_AppearanceDegradesOnError(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeSettings{err: errors.New("settings down")}, fakeResonance{})
	ctx := context.Background()
	repo.stars["u1"] = []StarLandscape{{ID: "a", Mood: "joy"}}
	st, _ := svc.UpdateSettings(ctx, "u1", true, "u")
	snap, err := svc.Snapshot(ctx, st.Slug)
	if err != nil {
		t.Fatalf("snapshot must not fail on settings error: %v", err)
	}
	if snap.Appearance.Theme != "" {
		t.Fatalf("want empty (default) appearance on error, got %+v", snap.Appearance)
	}
	if len(snap.Stars) != 1 {
		t.Fatalf("landscape graph must still render: got %d stars", len(snap.Stars))
	}
}

func errSnapshot(t *testing.T, svc *Service, slug string) error {
	t.Helper()
	_, err := svc.Snapshot(context.Background(), slug)
	return err
}

// enable turns on sharing for a user and returns the minted slug (test helper).
func enableShare(t *testing.T, svc *Service, user string) string {
	t.Helper()
	st, err := svc.UpdateSettings(context.Background(), user, true, "")
	if err != nil {
		t.Fatalf("enable %s: %v", user, err)
	}
	return st.Slug
}

// 2.1 (spec 37): a resonance party gets a bridge carrying their OWN star id + the partner star's
// index in the public snapshot. The index uses the SAME ORDER BY m.id as ListStars/the snapshot,
// so "b" (the 2nd of a,b,c) maps to index 1 — aligned with the GetSharedUniverse array.
func TestResonanceBridges_PartyGetsSnapshotIndex(t *testing.T) {
	repo := newFakeRepo()
	// 삽입 순서를 일부러 섞는다(c,a,b) — 인덱스가 *정렬*(ORDER BY m.id: a,b,c)에서 나오는지 확인하기
	// 위함이다. 픽스처가 이미 정렬돼 있으면 정렬 로직을 안 거쳐도 통과해 ORDER BY drift를 못 잡는다.
	repo.stars["u1"] = []StarLandscape{{ID: "c"}, {ID: "a"}, {ID: "b"}}
	svc := NewService(repo, fakeSettings{}, fakeResonance{pairs: map[string][]ResonancePair{
		"u2|u1": {{MyMemoryID: "mine-1", TheirMemoryID: "b"}},
	}})
	slug := enableShare(t, svc, "u1")

	bridges, err := svc.ResonanceBridges(context.Background(), "u2", slug)
	if err != nil {
		t.Fatalf("bridges: %v", err)
	}
	if len(bridges) != 1 {
		t.Fatalf("want 1 bridge, got %d", len(bridges))
	}
	// 정렬 순서 a,b,c → b는 인덱스 1(삽입 순서 2가 아니라).
	if bridges[0].MyMemoryID != "mine-1" || bridges[0].TheirStarIndex != 1 {
		t.Fatalf("want {mine-1, index 1 (= star b in sorted a,b,c)}, got %+v", bridges[0])
	}
}

// 설계 요점(spec 37): ResonanceBridges의 their_star_index는 GetSharedUniverse(Snapshot) 배열의 같은
// 인덱스여야 한다 — 두 경로(ListStarIDs vs ListStars)가 같은 ORDER BY m.id를 공유하므로 같은 별은 같은
// 자리에 놓인다. 시냅스로 Snapshot의 별 인덱스를 들여다봐 다리 인덱스와 일치하는지 교차 검증한다(한쪽
// 경로만 정렬이 갈리면 잡힌다 — 순서 drift = 엉뚱한 별 하이라이트 = 프라이버시/정합 버그).
func TestResonanceBridges_IndexMatchesSnapshotOrder(t *testing.T) {
	repo := newFakeRepo()
	repo.stars["u1"] = []StarLandscape{{ID: "c"}, {ID: "a"}, {ID: "b"}} // 비정렬 삽입
	repo.syn["u1"] = []SynapseLandscape{{AID: "b", BID: "c", Weight: 0.5}} // b↔c — Snapshot이 b,c에 준 인덱스를 들여다본다
	svc := NewService(repo, fakeSettings{}, fakeResonance{pairs: map[string][]ResonancePair{
		"u2|u1": {{MyMemoryID: "mine-1", TheirMemoryID: "b"}},
	}})
	slug := enableShare(t, svc, "u1")

	snap, err := svc.Snapshot(context.Background(), slug)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	bridges, err := svc.ResonanceBridges(context.Background(), "u2", slug)
	if err != nil {
		t.Fatalf("bridges: %v", err)
	}
	if len(snap.Synapses) != 1 || len(bridges) != 1 {
		t.Fatalf("want 1 synapse + 1 bridge, got %d / %d", len(snap.Synapses), len(bridges))
	}
	// Snapshot 시냅스 끝점 A = 별 b의 인덱스(AID="b"). 다리의 their_star_index도 b를 가리키므로 같아야 한다.
	if bridges[0].TheirStarIndex != snap.Synapses[0].A {
		t.Fatalf("bridge index %d must equal snapshot index of star b %d (shared ORDER BY m.id)",
			bridges[0].TheirStarIndex, snap.Synapses[0].A)
	}
}

// 2.2: a non-party caller (no caller↔owner resonance) gets an EMPTY list — the existence of any
// resonance between the owner and someone else is never disclosed.
func TestResonanceBridges_NonPartyGetsEmpty(t *testing.T) {
	repo := newFakeRepo()
	repo.stars["u1"] = []StarLandscape{{ID: "a"}, {ID: "b"}}
	svc := NewService(repo, fakeSettings{}, fakeResonance{pairs: map[string][]ResonancePair{
		"u2|u1": {{MyMemoryID: "mine-1", TheirMemoryID: "a"}}, // u2 is a party; u3 is not
	}})
	slug := enableShare(t, svc, "u1")

	bridges, err := svc.ResonanceBridges(context.Background(), "u3", slug)
	if err != nil {
		t.Fatalf("bridges: %v", err)
	}
	if len(bridges) != 0 {
		t.Fatalf("a non-party caller must get 0 bridges, got %d", len(bridges))
	}
}

// 3.2: when the owner turns sharing OFF, the slug stops resolving, so the overlay bridge read is
// blocked by the SAME uniform NotFound as a visit — overlay dies the instant sharing does.
func TestResonanceBridges_ShareOffIsNotFound(t *testing.T) {
	repo := newFakeRepo()
	repo.stars["u1"] = []StarLandscape{{ID: "a"}}
	svc := NewService(repo, fakeSettings{}, fakeResonance{pairs: map[string][]ResonancePair{
		"u2|u1": {{MyMemoryID: "mine-1", TheirMemoryID: "a"}},
	}})
	slug := enableShare(t, svc, "u1")
	if _, err := svc.UpdateSettings(context.Background(), "u1", false, ""); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if _, err := svc.ResonanceBridges(context.Background(), "u2", slug); !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound after share off, got %v", err)
	}
}

// An owner-end memory that isn't in the current snapshot is dropped — never emit a stray index.
func TestResonanceBridges_UnknownPartnerStarDropped(t *testing.T) {
	repo := newFakeRepo()
	repo.stars["u1"] = []StarLandscape{{ID: "a"}, {ID: "b"}}
	svc := NewService(repo, fakeSettings{}, fakeResonance{pairs: map[string][]ResonancePair{
		"u2|u1": {
			{MyMemoryID: "mine-1", TheirMemoryID: "b"},     // in snapshot → index 1
			{MyMemoryID: "mine-2", TheirMemoryID: "ghost"}, // not in snapshot → dropped
		},
	}})
	slug := enableShare(t, svc, "u1")

	bridges, err := svc.ResonanceBridges(context.Background(), "u2", slug)
	if err != nil {
		t.Fatalf("bridges: %v", err)
	}
	if len(bridges) != 1 || bridges[0].TheirStarIndex != 1 {
		t.Fatalf("want only the in-snapshot bridge (index 1), got %+v", bridges)
	}
}
