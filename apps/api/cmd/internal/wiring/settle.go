package wiring

import (
	"context"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/store"
	storepg "github.com/cosimosi/api/internal/store/pg"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
	"github.com/jackc/pgx/v5/pgxpool"
)

// LedgerZoneReader binds account's published zone read to an open transaction (ARCH-9), so an earn
// or spend inside it never waits on a second pooled connection.
func LedgerZoneReader(tx dbgen.DBTX) twinkle.ZoneReader {
	return account.NewZoneReader(accountpg.NewStore(tx))
}

// TwinkleZone is the only binding of twinkle's UserZoneReader ([G2][U7]): account's published profile
// read, published as the IANA name twinkle's port asks for. It resolves nothing itself — twinkle owns
// the name→location step and the UTC fallback, so no permissive adapter can bind the boundary away.
type TwinkleZone struct {
	Service interface {
		ZoneFor(context.Context, platform.UserScope) (string, error)
		ZonesFor(context.Context, []string) (map[string]string, error)
	}
}

func (z TwinkleZone) ZoneFor(ctx context.Context, scope platform.UserScope) (string, error) {
	return z.Service.ZoneFor(ctx, scope)
}

func (z TwinkleZone) ZonesFor(ctx context.Context, userIDs []string) (map[string]string, error) {
	return z.Service.ZonesFor(ctx, userIDs)
}

// TwinkleGranter is a claim's stardust leg over the shipped achievement-reward earn. The claim id is
// the dedup key, so a replay credits nothing and still answers the same total; the earn credits
// GENERAL by construction, which is where "no SMALL reward" actually holds.
type TwinkleGranter struct {
	Service *twinkle.Service
}

func (g TwinkleGranter) EarnAchievementReward(ctx context.Context, scope platform.UserScope, claimID string, amount int) (int, error) {
	balance, err := g.Service.EarnAchievementReward(ctx, scope, claimID, amount)
	if err != nil {
		return 0, err
	}
	return balance.General, nil
}

// OrnamentGranter is a claim's rare-ornament leg over the store's ownership append, which is ON
// CONFLICT DO NOTHING — so a replayed claim grants once. The claim id is unused: the ownership row's
// own primary key is the dedup identity.
type OrnamentGranter struct {
	Service *store.Service
}

func (g OrnamentGranter) Grant(ctx context.Context, scope platform.UserScope, _ string, ornamentID string) error {
	return g.Service.GrantOwnership(ctx, scope, store.OrnamentID(ornamentID), store.AcquisitionAchievement)
}

// newAchievementSettler builds the job worker's drain leg. It pays through the same published behavior
// the API does — twinkle's achievement earn and store's ownership grant — so a drained claim and a
// pressed one credit through one code path and one pair of dedup keys. What twinkle and store need for
// the paths the worker does not run is fail-closed: it quotes no spend, settles no invite and charges
// no purchase.
func newAchievementSettler(db *pgxpool.Pool, zones TwinkleZone) (*achievement.Service, error) {
	twinkleService, err := twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         twinklepg.NewStore(db).WithZoneBinding(LedgerZoneReader),
		InviteResolver: twinkle.UnavailableInviteResolver{},
		Signals:        noSpendSignals{},
		UserZone:       zones,
	})
	if err != nil {
		return nil, err
	}
	// A grant runs in its own transaction so the ownership row and the ornament-owned counter commit
	// together; the counter goes through the same recorder the API binds.
	progress := achievement.NewRecorder()
	ornaments := storepg.NewStore(db).WithEconomyBinding(func(tx dbgen.DBTX) store.EconomyTx {
		return settleStoreTransaction{tx: tx, progress: progress}
	})
	storeService, err := store.NewService(store.ServiceDeps{
		Ownerships: ornaments,
		Selections: ornaments,
		Purge:      ornaments,
		Decorate:   ornaments,
	})
	if err != nil {
		return nil, err
	}
	return achievement.NewService(achievement.AchievementServiceDeps{
		Repo:        achievementpg.NewStore(db),
		Twinkle:     TwinkleGranter{Service: twinkleService},
		Ornaments:   OrnamentGranter{Service: storeService},
		Settlements: noSettlementScheduler{},
	})
}

// settleStoreTransaction is the drain's store capability: the grant's counter report rides the grant's
// transaction, and a purchase charge is refused, since the drain never charges.
type settleStoreTransaction struct {
	tx       dbgen.DBTX
	progress *achievement.Recorder
}

func (settleStoreTransaction) SpendPurchase(context.Context, platform.UserScope, store.PurchaseSpend) error {
	return ErrPurchaseUnavailable
}

func (t settleStoreTransaction) RecordProgress(ctx context.Context, scope platform.UserScope, key string, delta int) error {
	return t.progress.RecordProgress(ctx, scope, achievementpg.NewReadStore(t.tx), achievement.CounterKey(key), delta)
}
