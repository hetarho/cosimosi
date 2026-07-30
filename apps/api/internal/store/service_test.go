package store_test

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
)

type fakeOrnamentRepo struct {
	ownerships map[string][]store.OrnamentOwnership
	selections map[string][]store.OrnamentSelection
	inserted   []store.OrnamentOwnership
	purged     []string
	listErr    error
	insertErr  error
}

func newFakeOrnamentRepo() *fakeOrnamentRepo {
	return &fakeOrnamentRepo{
		ownerships: map[string][]store.OrnamentOwnership{},
		selections: map[string][]store.OrnamentSelection{},
	}
}

func (f *fakeOrnamentRepo) ListOrnamentOwnerships(
	_ context.Context,
	scope platform.UserScope,
) ([]store.OrnamentOwnership, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.ownerships[scope.UserID()], nil
}

func (f *fakeOrnamentRepo) InsertOrnamentOwnership(
	_ context.Context,
	scope platform.UserScope,
	ornamentID store.OrnamentID,
	acquiredVia store.OrnamentAcquisition,
) (bool, error) {
	if f.insertErr != nil {
		return false, f.insertErr
	}
	for _, existing := range f.ownerships[scope.UserID()] {
		if existing.OrnamentID == ornamentID {
			return false, nil
		}
	}
	ownership := store.OrnamentOwnership{OrnamentID: ornamentID, AcquiredVia: acquiredVia}
	f.ownerships[scope.UserID()] = append(f.ownerships[scope.UserID()], ownership)
	f.inserted = append(f.inserted, ownership)
	return true, nil
}

func (f *fakeOrnamentRepo) ListOrnamentSelections(
	_ context.Context,
	scope platform.UserScope,
) ([]store.OrnamentSelection, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.selections[scope.UserID()], nil
}

// clone/adopt let the fake stand in for a transaction: a staged copy is discarded on refusal, so a
// test can assert that a refused save left the tables exactly as they were.
func (f *fakeOrnamentRepo) clone() *fakeOrnamentRepo {
	staged := newFakeOrnamentRepo()
	staged.listErr = f.listErr
	staged.insertErr = f.insertErr
	for userID, rows := range f.ownerships {
		staged.ownerships[userID] = append([]store.OrnamentOwnership(nil), rows...)
	}
	for userID, rows := range f.selections {
		staged.selections[userID] = append([]store.OrnamentSelection(nil), rows...)
	}
	return staged
}

func (f *fakeOrnamentRepo) adopt(staged *fakeOrnamentRepo) {
	f.ownerships = staged.ownerships
	f.selections = staged.selections
	f.inserted = append(f.inserted, staged.inserted...)
}

func (f *fakeOrnamentRepo) UpsertOrnamentSelection(
	_ context.Context,
	scope platform.UserScope,
	selection store.OrnamentSelection,
) error {
	rows := f.selections[scope.UserID()]
	for i, existing := range rows {
		if existing.Kind == selection.Kind {
			rows[i] = selection
			return nil
		}
	}
	f.selections[scope.UserID()] = append(rows, selection)
	return nil
}

func (f *fakeOrnamentRepo) DeleteOrnamentSelection(
	_ context.Context,
	scope platform.UserScope,
	kind store.OrnamentKind,
) error {
	kept := make([]store.OrnamentSelection, 0, len(f.selections[scope.UserID()]))
	for _, existing := range f.selections[scope.UserID()] {
		if existing.Kind != kind {
			kept = append(kept, existing)
		}
	}
	f.selections[scope.UserID()] = kept
	return nil
}

func (f *fakeOrnamentRepo) PurgeUser(_ context.Context, scope platform.UserScope) error {
	delete(f.ownerships, scope.UserID())
	delete(f.selections, scope.UserID())
	f.purged = append(f.purged, scope.UserID())
	return nil
}

func newTestService(t *testing.T, repo *fakeOrnamentRepo) *store.Service {
	t.Helper()
	service, _ := newGrantService(t, repo)
	return service
}

// newGrantService binds the two seams a grant now needs — the transaction it runs in and a CAPTURING
// recorder, since the shipped NoAchievementRecorder records nothing and a test over it would assert
// against a no-op.
func newGrantService(t *testing.T, repo *fakeOrnamentRepo) (*store.Service, *fakeRecorder) {
	t.Helper()
	recorder := &fakeRecorder{}
	service, err := store.NewService(store.ServiceDeps{
		Ownerships:   repo,
		Selections:   repo,
		Purge:        repo,
		Decorate:     &fakeDecorateRepo{repo: repo},
		Achievements: recorder,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service, recorder
}

func testScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

func TestNewServiceRefusesMissingRepositories(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	for name, deps := range map[string]store.ServiceDeps{
		"no ownerships": {Selections: repo, Purge: repo},
		"no selections": {Ownerships: repo, Purge: repo},
		"no purge":      {Ownerships: repo, Selections: repo},
	} {
		if _, err := store.NewService(deps); !errors.Is(err, store.ErrStoreRequired) {
			t.Errorf("%s: err = %v, want ErrStoreRequired", name, err)
		}
	}
}

func TestCatalogAnswersEveryRowWithOwnershipPriceAndSelection(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	scope := testScope(t, "catalog-user")
	repo.ownerships[scope.UserID()] = []store.OrnamentOwnership{
		{OrnamentID: "background.grainstorm", AcquiredVia: store.AcquisitionPurchase},
	}
	repo.selections[scope.UserID()] = []store.OrnamentSelection{
		{Kind: store.KindBackground, OrnamentID: "background.grainstorm"},
	}
	items, err := newTestService(t, repo).Catalog(context.Background(), scope)
	if err != nil {
		t.Fatalf("Catalog failed: %v", err)
	}
	if len(items) != len(store.Ornaments()) {
		t.Fatalf("catalog answered %d rows, want every published row", len(items))
	}
	byID := map[store.OrnamentID]store.CatalogItem{}
	for _, item := range items {
		byID[item.ID] = item
	}
	bought := byID["background.grainstorm"]
	if !bought.Owned || !bought.Selected {
		t.Errorf("bought and applied row = %+v, want owned and selected", bought)
	}
	free := byID[store.DefaultBackgroundOrnamentID]
	if !free.Owned || free.Price != 0 || free.Selected {
		t.Errorf("free default = %+v, want owned, priceless and unselected", free)
	}
	unowned := byID["background.lightfall"]
	if unowned.Owned || unowned.Price == 0 {
		t.Errorf("unowned purchasable row = %+v, want unowned with a price", unowned)
	}
	// A row owned by another user is not this caller's.
	other := testScope(t, "other-user")
	repo.ownerships[other.UserID()] = []store.OrnamentOwnership{
		{OrnamentID: "background.lightfall", AcquiredVia: store.AcquisitionPurchase},
	}
	items, err = newTestService(t, repo).Catalog(context.Background(), scope)
	if err != nil {
		t.Fatalf("Catalog failed: %v", err)
	}
	for _, item := range items {
		if item.ID == "background.lightfall" && item.Owned {
			t.Error("another user's ownership leaked into this catalog read")
		}
	}
}

func TestSelectionAnswersOneEntryPerKindAndCoercesUnknownIDs(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	service := newTestService(t, repo)
	scope := testScope(t, "selection-user")

	// Absent rows: every kind answers its default.
	selection, err := service.Selection(context.Background(), scope)
	if err != nil {
		t.Fatalf("Selection failed: %v", err)
	}
	if len(selection) != 2 {
		t.Fatalf("selection = %+v, want one entry per kind", selection)
	}
	wantDefaults := map[store.OrnamentKind]store.OrnamentID{
		store.KindBackground: store.DefaultBackgroundOrnamentID,
		store.KindStarShader: store.DefaultStarShaderOrnamentID,
	}
	for _, entry := range selection {
		if entry.OrnamentID != wantDefaults[entry.Kind] {
			t.Errorf("%s = %q, want the default %q", entry.Kind, entry.OrnamentID, wantDefaults[entry.Kind])
		}
	}

	// A retired id resolves to the default; the sibling kind's real selection is untouched.
	repo.selections[scope.UserID()] = []store.OrnamentSelection{
		{Kind: store.KindBackground, OrnamentID: "background.retired-sky"},
		{Kind: store.KindStarShader, OrnamentID: "star_shader.geode"},
	}
	selection, err = service.Selection(context.Background(), scope)
	if err != nil {
		t.Fatalf("Selection failed: %v", err)
	}
	applied := map[store.OrnamentKind]store.OrnamentID{}
	for _, entry := range selection {
		applied[entry.Kind] = entry.OrnamentID
	}
	if applied[store.KindBackground] != store.DefaultBackgroundOrnamentID {
		t.Errorf("retired background = %q, want the default", applied[store.KindBackground])
	}
	if applied[store.KindStarShader] != "star_shader.geode" {
		t.Errorf("%s = %q, want the stored row", store.KindStarShader, applied[store.KindStarShader])
	}
}

func TestGrantOwnershipValidatesIDsAndAcquisitionAndIsIdempotent(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	service := newTestService(t, repo)
	scope := testScope(t, "grant-user")
	ctx := context.Background()

	if err := service.GrantOwnership(ctx, scope, "background.nope", store.AcquisitionPurchase); !errors.Is(err, store.ErrUnknownOrnamentID) {
		t.Errorf("unknown id err = %v, want ErrUnknownOrnamentID", err)
	}
	if err := service.GrantOwnership(ctx, scope, "star_shader.spire", store.AcquisitionFree); !errors.Is(err, store.ErrAcquisitionNotGrantable) {
		t.Errorf("free grant err = %v, want ErrAcquisitionNotGrantable", err)
	}
	// The path must be the one the catalog assigns: buying an achievement-only row and awarding a
	// purchasable one are both refused, so neither the unbuyable rule nor the audit trail depends on
	// the caller passing the right argument.
	if err := service.GrantOwnership(ctx, scope, "star_shader.spire", store.AcquisitionPurchase); !errors.Is(err, store.ErrAcquisitionNotGrantable) {
		t.Errorf("purchase of an achievement row err = %v, want ErrAcquisitionNotGrantable", err)
	}
	if err := service.GrantOwnership(ctx, scope, "background.lightfall", store.AcquisitionAchievement); !errors.Is(err, store.ErrAcquisitionNotGrantable) {
		t.Errorf("award of a purchasable row err = %v, want ErrAcquisitionNotGrantable", err)
	}
	if err := service.GrantOwnership(ctx, scope, "background.lightfall", store.AcquisitionPurchase); err != nil {
		t.Errorf("purchase of a purchasable row err = %v, want nil", err)
	}
	for range 2 {
		if err := service.GrantOwnership(ctx, scope, "star_shader.spire", store.AcquisitionAchievement); err != nil {
			t.Fatalf("GrantOwnership failed: %v", err)
		}
	}
	if len(repo.inserted) != 2 ||
		repo.inserted[0].AcquiredVia != store.AcquisitionPurchase ||
		repo.inserted[1].AcquiredVia != store.AcquisitionAchievement {
		t.Errorf("inserted ownerships = %+v, want one purchase then one achievement row", repo.inserted)
	}
}

// A capstone claim used to grow ownership without moving the counter its own tiers read, so the total
// waited for the user's next decoration save. Both legs report now, and both report the TOTAL: the
// counter is a high-water mark, so a repeated report is a no-op rather than a double count.
func TestGrantOwnershipReportsTheOwnershipTotal(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	service, recorder := newGrantService(t, repo)
	scope := testScope(t, "grant-counter-user")
	ctx := context.Background()

	if err := service.GrantOwnership(ctx, scope, "star_shader.spire", store.AcquisitionAchievement); err != nil {
		t.Fatalf("GrantOwnership failed: %v", err)
	}
	if len(recorder.progress) != 1 || recorder.progress[0] != (recordedProgress{key: store.CounterOrnamentOwned, delta: 1}) {
		t.Fatalf("progress = %+v, want one ornament_owned total of 1", recorder.progress)
	}
	// A second grant of the same ornament inserts nothing and re-reports the same total — which the
	// reach counter absorbs. The purchase leg's own report through a decoration save is the same shape.
	if err := service.GrantOwnership(ctx, scope, "star_shader.spire", store.AcquisitionAchievement); err != nil {
		t.Fatalf("replayed GrantOwnership failed: %v", err)
	}
	if len(repo.inserted) != 1 {
		t.Errorf("inserted = %+v, want the replay to have granted nothing", repo.inserted)
	}
	if len(recorder.progress) != 2 || recorder.progress[1] != (recordedProgress{key: store.CounterOrnamentOwned, delta: 1}) {
		t.Fatalf("progress = %+v, want the replay to re-report the same total", recorder.progress)
	}

	// A second, different ornament moves the total.
	if err := service.GrantOwnership(ctx, scope, "background.floating-lines", store.AcquisitionAchievement); err != nil {
		t.Fatalf("second GrantOwnership failed: %v", err)
	}
	if last := recorder.progress[len(recorder.progress)-1]; last.delta != 2 {
		t.Errorf("progress after a second ornament = %+v, want a total of 2", last)
	}
}

// A report failure fails the whole grant, and the insert goes with it. Losing the count instead would
// leave a fact nothing re-derives; failing is recoverable, because the claim that called this wraps a
// granter error as a retryable refusal and replays the idempotent grant.
func TestGrantOwnershipRollsBackWhenTheCounterReportFails(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	recorder := &fakeRecorder{err: errors.New("counter store unavailable")}
	tx := &fakeDecorateRepo{repo: repo}
	service, err := store.NewService(store.ServiceDeps{
		Ownerships:   repo,
		Selections:   repo,
		Purge:        repo,
		Decorate:     tx,
		Achievements: recorder,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope := testScope(t, "grant-rollback-user")

	if err := service.GrantOwnership(
		context.Background(), scope, "star_shader.spire", store.AcquisitionAchievement,
	); err == nil {
		t.Fatal("a failed counter report still reported a successful grant")
	}
	if len(repo.inserted) != 0 || tx.rollbacks != 1 {
		t.Errorf("inserted = %+v rollbacks = %d, want the insert rolled back with the report", repo.inserted, tx.rollbacks)
	}
}

func TestPurgeUserTouchesOnlyTheCallerAndRefusesAnEmptyScope(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	service := newTestService(t, repo)
	scope := testScope(t, "purge-user")
	other := testScope(t, "kept-user")
	repo.ownerships[scope.UserID()] = []store.OrnamentOwnership{{OrnamentID: "background.lightfall"}}
	repo.ownerships[other.UserID()] = []store.OrnamentOwnership{{OrnamentID: "background.lightfall"}}
	repo.selections[other.UserID()] = []store.OrnamentSelection{
		{Kind: store.KindBackground, OrnamentID: "background.lightfall"},
	}

	if err := service.PurgeUser(context.Background(), scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	if len(repo.ownerships[scope.UserID()]) != 0 {
		t.Error("purge left the caller's ownership rows")
	}
	if len(repo.ownerships[other.UserID()]) != 1 || len(repo.selections[other.UserID()]) != 1 {
		t.Error("purge reached another user's rows")
	}

	if err := service.PurgeUser(context.Background(), platform.UserScope{}); !errors.Is(err, store.ErrScopeRequired) {
		t.Errorf("scopeless purge err = %v, want ErrScopeRequired", err)
	}
}

func TestEveryReadRefusesAnUnauthenticatedScope(t *testing.T) {
	t.Parallel()
	service := newTestService(t, newFakeOrnamentRepo())
	if _, err := service.Catalog(context.Background(), platform.UserScope{}); !errors.Is(err, store.ErrScopeRequired) {
		t.Errorf("Catalog err = %v, want ErrScopeRequired", err)
	}
	if _, err := service.Selection(context.Background(), platform.UserScope{}); !errors.Is(err, store.ErrScopeRequired) {
		t.Errorf("Selection err = %v, want ErrScopeRequired", err)
	}
	if err := service.GrantOwnership(
		context.Background(),
		platform.UserScope{},
		store.DefaultBackgroundOrnamentID,
		store.AcquisitionPurchase,
	); !errors.Is(err, store.ErrScopeRequired) {
		t.Errorf("GrantOwnership err = %v, want ErrScopeRequired", err)
	}
}

func TestWithdrawalPurgerNamesTheContextAndDelegates(t *testing.T) {
	t.Parallel()
	repo := newFakeOrnamentRepo()
	purger := store.NewWithdrawalPurger(repo)
	if purger.PurgeName() != "store" {
		t.Errorf("PurgeName = %q, want store", purger.PurgeName())
	}
	scope := testScope(t, "sweep-user")
	if err := purger.PurgeUser(context.Background(), scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	if len(repo.purged) != 1 || repo.purged[0] != scope.UserID() {
		t.Errorf("purged = %v, want exactly the swept user", repo.purged)
	}
	if err := store.NewWithdrawalPurger(nil).PurgeUser(context.Background(), scope); !errors.Is(err, store.ErrStoreRequired) {
		t.Error("an unwired purger silently succeeded")
	}
	if err := purger.PurgeUser(context.Background(), platform.UserScope{}); !errors.Is(err, store.ErrScopeRequired) {
		t.Error("a scopeless sweep leg silently succeeded")
	}
}
