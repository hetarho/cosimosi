package store_test

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
)

// fakeDecorateRepo runs a "transaction" that either commits or discards, so a refusal can be asserted
// to have left nothing behind — the whole point of [P8].
type fakeDecorateRepo struct {
	repo      *fakeOrnamentRepo
	rollbacks int
}

func (f *fakeDecorateRepo) InDecorateTx(ctx context.Context, fn func(tx store.DecorateTx) error) error {
	staged := f.repo.clone()
	if err := fn(staged); err != nil {
		f.rollbacks++
		return err
	}
	f.repo.adopt(staged)
	return nil
}

type recordedSpend struct {
	amount   int
	dedupKey string
}

type fakeSpendGate struct {
	spends    []recordedSpend
	refuseAt  int
	eligible  int
	cost      int
	shortfall int
	// bare stands in for the economy's raced refusal: the sentinel with no arithmetic behind it.
	bare bool
}

func (g *fakeSpendGate) CheckAndSpend(
	_ context.Context,
	_ platform.UserScope,
	_ store.EconomyTx,
	spend store.PurchaseSpend,
) error {
	if g.refuseAt > 0 && spend.Amount >= g.refuseAt {
		if g.bare {
			return store.ErrInsufficientTwinkle
		}
		return &store.InsufficientTwinkle{Cost: g.cost, Eligible: g.eligible, Shortfall: g.shortfall}
	}
	g.spends = append(g.spends, recordedSpend{amount: spend.Amount, dedupKey: spend.DedupKey})
	return nil
}

type recordedProgress struct {
	key   string
	delta int
}

type fakeRecorder struct {
	progress []recordedProgress
	err      error
}

func (r *fakeRecorder) RecordProgress(
	_ context.Context,
	_ platform.UserScope,
	_ store.EconomyTx,
	counterKey string,
	delta int,
) error {
	r.progress = append(r.progress, recordedProgress{key: counterKey, delta: delta})
	return r.err
}

type decorateHarness struct {
	service  *store.Service
	repo     *fakeOrnamentRepo
	tx       *fakeDecorateRepo
	gate     *fakeSpendGate
	recorder *fakeRecorder
	scope    platform.UserScope
}

func newDecorateHarness(t *testing.T) decorateHarness {
	t.Helper()
	repo := newFakeOrnamentRepo()
	tx := &fakeDecorateRepo{repo: repo}
	gate := &fakeSpendGate{}
	recorder := &fakeRecorder{}
	service, err := store.NewService(store.ServiceDeps{
		Ownerships:   repo,
		Selections:   repo,
		Purge:        repo,
		Decorate:     tx,
		Spend:        gate,
		Achievements: recorder,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return decorateHarness{
		service:  service,
		repo:     repo,
		tx:       tx,
		gate:     gate,
		recorder: recorder,
		scope:    testScope(t, "decorate-user"),
	}
}

func TestDecorateBuysOnlyTheUnownedAndAppliesEveryKind(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	applied, spent, err := h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
		store.KindStarShader: "star_shader.geode",
	})
	if err != nil {
		t.Fatalf("Decorate failed: %v", err)
	}
	wantSpent := store.PriceOf(mustOrnament(t, "background.lightfall")) +
		store.PriceOf(mustOrnament(t, "star_shader.geode"))
	if spent != wantSpent {
		t.Errorf("spent = %d, want %d", spent, wantSpent)
	}
	if len(h.gate.spends) != 1 || h.gate.spends[0].amount != wantSpent {
		t.Errorf("spends = %+v, want one debit of %d", h.gate.spends, wantSpent)
	}
	if len(applied) != len(store.AllOrnamentKinds()) {
		t.Fatalf("applied = %+v, want one entry per kind", applied)
	}
	if len(h.repo.ownerships[h.scope.UserID()]) != 2 {
		t.Errorf("ownerships = %+v, want both rows", h.repo.ownerships[h.scope.UserID()])
	}

	// Saving the same thing again buys nothing, charges nothing and writes no ledger row.
	_, spent, err = h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
		store.KindStarShader: "star_shader.geode",
	})
	if err != nil || spent != 0 {
		t.Fatalf("re-save = spent %d, err %v, want a free no-op", spent, err)
	}
	if len(h.gate.spends) != 1 {
		t.Errorf("spends after re-save = %+v, want still one", h.gate.spends)
	}
}

// The charge follows what the INSERT acquired, so the second of two identical saves is free even
// though both were told the same thing.
func TestDecorateChargesOnceForConcurrentIdenticalSaves(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	selection := store.Selection{store.KindBackground: "background.lightfall"}
	for range 2 {
		if _, _, err := h.service.Decorate(context.Background(), h.scope, selection); err != nil {
			t.Fatalf("Decorate failed: %v", err)
		}
	}
	if len(h.gate.spends) != 1 {
		t.Fatalf("spends = %+v, want exactly one", h.gate.spends)
	}
	if h.gate.spends[0].dedupKey == "" {
		t.Error("the debit carries no dedup key, so a retry could charge twice")
	}
}

func TestDecorateFreeSelectionCostsNothingAndKeepsAbsenceAsTheDefault(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	// Naming the default explicitly IS the default: no ownership row, no ledger row and — because
	// absence is the one representation — no applied row and no recorded progress either.
	applied, spent, err := h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: store.DefaultBackgroundOrnamentID,
	})
	if err != nil || spent != 0 {
		t.Fatalf("free save = spent %d, err %v", spent, err)
	}
	if len(h.repo.ownerships[h.scope.UserID()]) != 0 {
		t.Errorf("free save wrote an ownership row: %+v", h.repo.ownerships[h.scope.UserID()])
	}
	if len(h.repo.selections[h.scope.UserID()]) != 0 {
		t.Errorf("an explicit default wrote an applied row: %+v", h.repo.selections[h.scope.UserID()])
	}
	if len(h.recorder.progress) != 0 {
		t.Errorf("an explicit default recorded progress: %+v", h.recorder.progress)
	}
	for _, entry := range applied {
		if entry.Kind == store.KindBackground && entry.OrnamentID != store.DefaultBackgroundOrnamentID {
			t.Errorf("background = %q, want the default", entry.OrnamentID)
		}
	}

	// An empty id reverts the kind by DELETING the row: absence stays the one way to say "default".
	if _, _, err := h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
	}); err != nil {
		t.Fatalf("Decorate failed: %v", err)
	}
	if len(h.repo.selections[h.scope.UserID()]) != 1 {
		t.Fatalf("selections = %+v, want the applied row", h.repo.selections[h.scope.UserID()])
	}
	applied, spent, err = h.service.Decorate(context.Background(), h.scope, store.Selection{})
	if err != nil {
		t.Fatalf("revert failed: %v", err)
	}
	if spent != 0 || len(h.repo.selections[h.scope.UserID()]) != 0 {
		t.Errorf("revert = spent %d, rows %+v, want free and rowless", spent, h.repo.selections[h.scope.UserID()])
	}
	if len(applied) != len(store.AllOrnamentKinds()) {
		t.Errorf("revert answered %+v, want one default entry per kind", applied)
	}
	// The bought ornament stays owned — reverting a look never gives money back ([P9][I1]).
	if len(h.repo.ownerships[h.scope.UserID()]) != 1 {
		t.Errorf("ownerships after revert = %+v, want the purchase kept", h.repo.ownerships[h.scope.UserID()])
	}
}

func TestDecorateRefusesTheWholeSaveWhenTheBalanceFallsShort(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	background := mustOrnament(t, "background.lightfall")
	shape := mustOrnament(t, "star_shader.geode")
	// Enough for the cheaper row alone, so the dearer one is the item to name.
	h.gate.eligible = store.PriceOf(background)
	h.gate.cost = store.PriceOf(background) + store.PriceOf(shape)
	h.gate.shortfall = h.gate.cost - h.gate.eligible
	h.gate.refuseAt = 1

	_, _, err := h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: background.ID,
		store.KindStarShader: shape.ID,
	})
	if !errors.Is(err, store.ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want ErrInsufficientTwinkle", err)
	}
	var insufficient *store.InsufficientTwinkle
	if !errors.As(err, &insufficient) {
		t.Fatalf("err = %v, want the typed refusal", err)
	}
	if insufficient.OrnamentID != shape.ID {
		t.Errorf("blamed %q, want the item that did not fit (%q)", insufficient.OrnamentID, shape.ID)
	}
	if insufficient.Detail()["shortfall"] != "600" {
		t.Errorf("detail = %v, want the economy's own shortfall forwarded", insufficient.Detail())
	}
	// Nothing bought, nothing applied, nothing recorded.
	if len(h.repo.ownerships[h.scope.UserID()]) != 0 || len(h.repo.selections[h.scope.UserID()]) != 0 {
		t.Error("a refused save left rows behind")
	}
	if len(h.recorder.progress) != 0 {
		t.Errorf("a refused save recorded progress: %+v", h.recorder.progress)
	}
	if h.tx.rollbacks != 1 {
		t.Errorf("rollbacks = %d, want the save rolled back", h.tx.rollbacks)
	}
}

func TestDecorateRefusesUnownedAchievementRowsAndUnknownIDs(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	ctx := context.Background()

	if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindStarShader: "star_shader.spire",
	}); !errors.Is(err, store.ErrOrnamentNotPurchasable) {
		t.Errorf("achievement row err = %v, want ErrOrnamentNotPurchasable", err)
	}
	if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindBackground: "background.no-such-sky",
	}); !errors.Is(err, store.ErrUnknownOrnamentID) {
		t.Errorf("unknown id err = %v, want ErrUnknownOrnamentID", err)
	}
	// A kind mismatch is refused too, and before any write: the field an id arrives on is part of the
	// claim being made.
	if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindBackground: "star_shader.geode",
	}); !errors.Is(err, store.ErrUnknownOrnamentID) {
		t.Errorf("kind mismatch err = %v, want ErrUnknownOrnamentID", err)
	}
	if len(h.gate.spends) != 0 || len(h.repo.ownerships[h.scope.UserID()]) != 0 {
		t.Error("a refused save reached the economy or the tables")
	}

	// Once granted by its achievement, the same ornament is free to wear.
	if err := h.service.GrantOwnership(ctx, h.scope, "star_shader.spire", store.AcquisitionAchievement); err != nil {
		t.Fatalf("GrantOwnership failed: %v", err)
	}
	_, spent, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindStarShader: "star_shader.spire",
	})
	if err != nil || spent != 0 {
		t.Fatalf("owned achievement row = spent %d, err %v, want free", spent, err)
	}
}

// A raced refusal the economy answers without its arithmetic still says how much the save wanted, and
// declines to guess at an item.
func TestDecorateForwardsARefusalThatCarriesNoArithmetic(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	h.gate.refuseAt = 1
	h.gate.bare = true
	_, _, err := h.service.Decorate(context.Background(), h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
	})
	var insufficient *store.InsufficientTwinkle
	if !errors.As(err, &insufficient) {
		t.Fatalf("err = %v, want the typed refusal even without the economy's numbers", err)
	}
	detail := insufficient.Detail()
	if detail["cost"] != "300" {
		t.Errorf("detail = %v, want the save's own total", detail)
	}
	if _, named := detail["shortfall"]; named {
		t.Errorf("detail = %v, want no invented shortfall", detail)
	}
	if _, named := detail["ornament_id"]; named {
		t.Errorf("detail = %v, want no guessed item", detail)
	}
}

// Alternating an explicit default and an empty id cannot report progress twice: both mean the same
// state, so the second save changes nothing.
func TestDecorateCannotFarmProgressByRestatingTheDefault(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	ctx := context.Background()
	for range 3 {
		if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
			store.KindBackground: store.DefaultBackgroundOrnamentID,
		}); err != nil {
			t.Fatalf("Decorate failed: %v", err)
		}
		if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{}); err != nil {
			t.Fatalf("Decorate failed: %v", err)
		}
	}
	if len(h.recorder.progress) != 0 {
		t.Errorf("progress = %+v, want none — nothing ever changed", h.recorder.progress)
	}
}

func TestDecorateRecordsCounterFactsOnlyWhenSomethingChanged(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	ctx := context.Background()
	if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
	}); err != nil {
		t.Fatalf("Decorate failed: %v", err)
	}
	want := []recordedProgress{
		{key: store.CounterDecorationSaved, delta: 1},
		{key: store.CounterOrnamentOwned, delta: 1},
		{key: store.CounterOrnamentKindDecorated(store.KindBackground), delta: 1},
	}
	if len(h.recorder.progress) != len(want) {
		t.Fatalf("progress = %+v, want %+v", h.recorder.progress, want)
	}
	for i, entry := range want {
		if h.recorder.progress[i] != entry {
			t.Errorf("progress[%d] = %+v, want %+v", i, h.recorder.progress[i], entry)
		}
	}
	// A save that changes nothing is a successful no-op that records nothing — so re-saving cannot
	// farm a counter.
	if _, _, err := h.service.Decorate(ctx, h.scope, store.Selection{
		store.KindBackground: "background.lightfall",
	}); err != nil {
		t.Fatalf("re-save failed: %v", err)
	}
	if len(h.recorder.progress) != len(want) {
		t.Errorf("progress after an unchanged save = %+v, want unchanged", h.recorder.progress)
	}
}

func TestDecorateRefusesWithoutScopeOrWiring(t *testing.T) {
	t.Parallel()
	h := newDecorateHarness(t)
	if _, _, err := h.service.Decorate(context.Background(), platform.UserScope{}, store.Selection{}); !errors.Is(err, store.ErrScopeRequired) {
		t.Errorf("scopeless save err = %v, want ErrScopeRequired", err)
	}
	// A service built for the reads alone refuses to save rather than half-saving.
	repo := newFakeOrnamentRepo()
	readOnly, err := store.NewService(store.ServiceDeps{
		Ownerships:   repo,
		Selections:   repo,
		Purge:        repo,
		Achievements: store.NoAchievementRecorder{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	if _, _, err := readOnly.Decorate(context.Background(), h.scope, store.Selection{}); !errors.Is(err, store.ErrStoreRequired) {
		t.Errorf("unwired save err = %v, want ErrStoreRequired", err)
	}
}

func mustOrnament(t *testing.T, id store.OrnamentID) store.Ornament {
	t.Helper()
	ornament, ok := store.LookupOrnament(id)
	if !ok {
		t.Fatalf("the catalog does not publish %q", id)
	}
	return ornament
}
