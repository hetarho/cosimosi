package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"connectrpc.com/connect"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	achievementrpc "github.com/cosimosi/api/internal/achievement/rpc"
	achievementv1connect "github.com/cosimosi/api/internal/gen/cosimosi/achievement/v1/achievementv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	"github.com/cosimosi/api/internal/twinkle"
)

// Achievement wiring (ARCHITECTURE §2.4). The context imports nothing and nothing imports it: its
// four cross-context edges — three producers reporting counters, the withdrawal sweep's purge, and
// the two reward legs a claim pays — are all closed here, where every concrete is visible.

var (
	// errRecorderTxUnusable is the wiring fault of a producer transaction the counter store cannot
	// be bound onto — never a client mistake.
	errRecorderTxUnusable = errors.New("producer tx does not expose a database handle")
	// errAchievementRecorderUnbound is the wiring fault of a producer reporting before the root
	// finished binding. It fails the producing transaction rather than dropping the report.
	errAchievementRecorderUnbound = errors.New("achievement recorder was not bound to a service")
	// errAchievementSettlementUnavailable is what a root that cannot settle invites answers if the
	// path is somehow reached — the fail-closed shape, not a silent no-op (the worker runs the
	// withdrawal sweep and never settles a signup).
	errAchievementSettlementUnavailable = errors.New("this root does not record achievement progress")
)

func newAchievementService(pool *platformdb.Pool, deps achievementDeps) (*achievement.Service, error) {
	if err := reconcileAchievementCounterKeys(); err != nil {
		return nil, err
	}
	if err := reconcileAchievementRewardOrnaments(); err != nil {
		return nil, err
	}
	return achievement.NewService(achievement.AchievementServiceDeps{
		Repo:      achievementpg.NewStore(pool.PgxPool()),
		Twinkle:   achievementTwinkleGranter{service: deps.twinkle},
		Ornaments: achievementOrnamentGranter{service: deps.store},
	})
}

// achievementDeps are the two contexts a claim pays through. They arrive as built services because a
// payout is published behavior, never a table.
type achievementDeps struct {
	twinkle *twinkle.Service
	store   *store.Service
}

// reconcileAchievementCounterKeys is the boot-time drift guard, and this is the only package that can
// run it: a producing context cannot import the catalog's constants, so its emitted keys are plain
// strings nothing checks.
func reconcileAchievementCounterKeys() error {
	return reconcileCounterKeys(slices.Concat(
		memory.AchievementCounterKeys(),
		store.AchievementCounterKeys(),
		account.AchievementCounterKeys(),
	))
}

// reconcileCounterKeys is the guard's body, parameterized on the emitted set so a test can drive a
// drifted producer through the SHIPPED comparison rather than a copy of it.
//
// Both directions are checked, each with exactly one sanctioned exemption for a key that legitimately
// lives on one side only:
//
//   - emitted but read by no condition is allowed ONLY for a key family member (`mood_recorded:JOY`),
//     whose purpose is to feed a variety counter. Any other unread key is a producer writing into
//     nothing — the shape a catalog rename leaves behind.
//   - read but emitted by nobody is allowed ONLY for a derived counter, which this context raises
//     itself. Any other unemitted key is an achievement nobody can reach.
func reconcileCounterKeys(emittedKeys []string) error {
	emitted := make(map[string]struct{}, len(emittedKeys))
	for _, key := range emittedKeys {
		emitted[key] = struct{}{}
	}
	read := map[string]struct{}{}
	for _, key := range achievement.CatalogCounterKeys() {
		read[string(key)] = struct{}{}
	}

	var writingIntoNothing, unreachable, notReportable []string
	for key := range emitted {
		// A derived counter is read by conditions, so the isRead arm below would wave it through — but
		// the recorder refuses it at runtime, so a producer claiming to emit one would fail every
		// transaction it reports from. Caught here instead.
		if achievement.DerivedCounterKey(achievement.CounterKey(key)) {
			notReportable = append(notReportable, key)
			continue
		}
		if _, isRead := read[key]; isRead {
			continue
		}
		if _, feedsVariety := achievement.VarietyCounterFor(achievement.CounterKey(key)); feedsVariety {
			continue
		}
		writingIntoNothing = append(writingIntoNothing, key)
	}
	for key := range read {
		if _, isEmitted := emitted[key]; isEmitted {
			continue
		}
		if achievement.DerivedCounterKey(achievement.CounterKey(key)) {
			continue
		}
		unreachable = append(unreachable, key)
	}
	slices.Sort(writingIntoNothing)
	slices.Sort(unreachable)
	slices.Sort(notReportable)
	if len(writingIntoNothing) > 0 || len(unreachable) > 0 || len(notReportable) > 0 {
		return fmt.Errorf(
			"achievement counter keys drifted: producers emit %v that no condition reads, and %v that the recorder refuses as derived; the catalog reads %v that nobody emits",
			writingIntoNothing, notReportable, unreachable,
		)
	}
	return nil
}

// reconcileAchievementRewardOrnaments refuses to boot on a reward naming an ornament the store
// catalog does not publish as achievement-only. The composition root is the only place both catalogs
// are visible, so an invalid reward id fails here rather than half-paying a claim.
func reconcileAchievementRewardOrnaments() error {
	for _, row := range achievement.Catalog() {
		if row.Reward.OrnamentID == "" {
			continue
		}
		ornament, published := store.LookupOrnament(store.OrnamentID(row.Reward.OrnamentID))
		if !published {
			return fmt.Errorf("achievement %s rewards unpublished ornament %s", row.ID, row.Reward.OrnamentID)
		}
		if ornament.Acquisition != store.AcquisitionAchievement {
			return fmt.Errorf(
				"achievement %s rewards ornament %s, which is acquired by %s",
				row.ID, row.Reward.OrnamentID, ornament.Acquisition,
			)
		}
	}
	return nil
}

// The three recorder adapters. Each binds a counter store onto the PRODUCER's own transaction, so the
// counter write commits or rolls back with the launch/recall/view/release/save that caused it — the
// shipped economy-seam pattern: the two contexts share the transaction and never the queries.

// achievementRecorderBinding is late-bound on purpose: the producing services are constructed before
// the achievement service exists, because a claim pays through twinkle and store, which are built
// after account. The root hands the producers this holder and binds the service once — the same shape
// the invite-reward granter already uses for the twinkle↔account cycle.
type achievementRecorderBinding struct {
	service *achievement.Service
	pool    *platformdb.Pool
}

func (b *achievementRecorderBinding) bind(service *achievement.Service) { b.service = service }

type achievementRecorder struct {
	binding *achievementRecorderBinding
}

func (r achievementRecorder) record(
	ctx context.Context,
	scope platform.UserScope,
	bound achievement.Store,
	counterKey string,
	delta int,
) error {
	if r.binding == nil || r.binding.service == nil {
		return errAchievementRecorderUnbound
	}
	return r.binding.service.RecordProgress(ctx, scope, bound, achievement.CounterKey(counterKey), delta)
}

// boundStore binds the counter store onto the producer's own transaction. A handle-less tx is a wiring
// fault and is refused rather than quietly written through the pool: a counter written outside the
// causing transaction would survive its rollback, which is exactly the guarantee the port promises.
func (r achievementRecorder) boundStore(tx any) (achievement.Store, error) {
	carrier, ok := tx.(interface{ DB() dbgen.DBTX })
	if !ok || carrier.DB() == nil {
		return nil, errRecorderTxUnusable
	}
	return achievementpg.NewStore(carrier.DB()), nil
}

// pooledStore is the one sanctioned transaction-less write: account's invite settlement is a locked
// sequence of statements rather than one transaction, so its report stands on its own and heals by
// replay instead of by rollback. Keeping it a SEPARATE method is what stops the transactional
// producers from silently taking the same fallback.
func (r achievementRecorder) pooledStore() achievement.Store {
	return achievementpg.NewStore(r.binding.pool.PgxPool())
}

// report is the transactional producers' shared body. The binding is checked BEFORE the transaction
// handle: an unbound recorder is a wiring fault whatever the caller passed, and reporting "tx
// unusable" for it would send the next reader after the wrong thing.
func (r achievementRecorder) report(
	ctx context.Context,
	scope platform.UserScope,
	tx any,
	counterKey string,
	delta int,
) error {
	if r.binding == nil || r.binding.service == nil {
		return errAchievementRecorderUnbound
	}
	bound, err := r.boundStore(tx)
	if err != nil {
		return err
	}
	return r.record(ctx, scope, bound, counterKey, delta)
}

type memoryAchievementRecorder struct{ achievementRecorder }

func (r memoryAchievementRecorder) RecordProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx memory.EconomyTx,
	counterKey string,
	delta int,
) error {
	return r.report(ctx, scope, tx, counterKey, delta)
}

type storeAchievementRecorder struct{ achievementRecorder }

func (r storeAchievementRecorder) RecordProgress(
	ctx context.Context,
	scope platform.UserScope,
	tx store.EconomyTx,
	counterKey string,
	delta int,
) error {
	return r.report(ctx, scope, tx, counterKey, delta)
}

// accountAchievementRecorder is the one producer whose report is NOT transactional — see pooledStore.
type accountAchievementRecorder struct{ achievementRecorder }

func (r accountAchievementRecorder) RecordProgress(
	ctx context.Context,
	scope platform.UserScope,
	_ any,
	counterKey string,
	delta int,
) error {
	if r.binding == nil || r.binding.pool == nil {
		return errAchievementRecorderUnbound
	}
	return r.record(ctx, scope, r.pooledStore(), counterKey, delta)
}

// achievementTwinkleGranter is the stardust leg over the shipped achievement-reward earn. The claim
// id is the dedup key, so a replay credits nothing and still answers the same total; the earn credits
// GENERAL by construction, which is where "no SMALL reward" actually holds.
type achievementTwinkleGranter struct {
	service *twinkle.Service
}

func (g achievementTwinkleGranter) EarnAchievementReward(
	ctx context.Context,
	scope platform.UserScope,
	claimID string,
	amount int,
) (int, error) {
	balance, err := g.service.EarnAchievementReward(ctx, scope, claimID, amount)
	if err != nil {
		return 0, err
	}
	return balance.General, nil
}

// achievementOrnamentGranter is the rare ornament leg over the store's ownership append, which is
// ON CONFLICT DO NOTHING — so a replayed claim grants once. The claim id is unused here: the
// ownership row's own primary key is the dedup identity.
type achievementOrnamentGranter struct {
	service *store.Service
}

func (g achievementOrnamentGranter) Grant(
	ctx context.Context,
	scope platform.UserScope,
	_ string,
	ornamentID string,
) error {
	return g.service.GrantOwnership(ctx, scope, store.OrnamentID(ornamentID), store.AcquisitionAchievement)
}

// accountAchievementUnavailable is the fail-closed account recorder for a root that never settles a
// signup (the worker, which runs only the withdrawal sweep). It refuses rather than silently
// counting nothing, so a path that unexpectedly reached it is loud.
type accountAchievementUnavailable struct{}

func (accountAchievementUnavailable) RecordProgress(
	context.Context,
	platform.UserScope,
	any,
	string,
	int,
) error {
	return errAchievementSettlementUnavailable
}

// achievementWithdrawalPurgerFor is the sweep's achievement leg, satisfying account's
// UserDataPurger port. Built straight over the pool: a sweep needs nothing the service composes.
func achievementWithdrawalPurgerFor(pool *platformdb.Pool) achievement.WithdrawalPurger {
	return achievement.NewWithdrawalPurger(achievementpg.NewStore(pool.PgxPool()))
}

// achievementServiceOption registers the AchievementService Connect handler.
func achievementServiceOption(service *achievement.Service) (platform.HandlerOption, error) {
	server, err := achievementrpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return achievementv1connect.NewAchievementServiceHandler(server, opts...)
	}), nil
}
