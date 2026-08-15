package main

import (
	"context"
	"fmt"
	"testing"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/admin"
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	"github.com/cosimosi/api/internal/ai"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/secretbox"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type adminQueryCounter struct {
	db       dbgen.DBTX
	execs    int
	queries  int
	queryRow int
}

func (c *adminQueryCounter) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	c.execs++
	return c.db.Exec(ctx, sql, args...)
}

func (c *adminQueryCounter) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	c.queries++
	return c.db.Query(ctx, sql, args...)
}

func (c *adminQueryCounter) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	c.queryRow++
	return c.db.QueryRow(ctx, sql, args...)
}

type adminIntegrationZones struct{ store accountpg.Store }

func (z adminIntegrationZones) ZoneFor(context.Context, platform.UserScope) (string, error) {
	return "UTC", nil
}

func (z adminIntegrationZones) ZonesFor(ctx context.Context, userIDs []string) (map[string]string, error) {
	stored, err := z.store.UserTimezones(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	zones := make(map[string]string, len(userIDs))
	for _, userID := range userIDs {
		zones[userID] = stored[userID]
		if zones[userID] == "" {
			zones[userID] = "UTC"
		}
	}
	return zones, nil
}

type adminIntegrationModels struct{}

func (adminIntegrationModels) ListModels(context.Context, admin.AICapability, string) ([]admin.ProviderModel, error) {
	return nil, nil
}

// A full default page stays at four database round trips: one account timezone batch, one Twinkle
// balance batch, one memory-count batch, and ListPromoted. Growing the page cannot grow this count.
func TestAdminUserListDatabaseRoundTripsStayConstant(t *testing.T) {
	pool := openEconomyTestPool(t)
	counter := &adminQueryCounter{db: pool.PgxPool()}
	accounts := make([]platformsupabase.Account, 0, values.AdminUserListPageSize)
	base := fmt.Sprintf("query-count-%d", time.Now().UnixNano())
	for i := range values.AdminUserListPageSize {
		userID := fmt.Sprintf("%s-user-%d", base, i)
		accounts = append(accounts, platformsupabase.Account{UserID: userID, Email: userID + "@example.com"})
	}

	twinkleService, err := twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         twinklepg.NewStore(counter),
		InviteResolver: twinkle.UnavailableInviteResolver{},
		Signals:        &memorySpendSignals{},
		UserZone:       adminIntegrationZones{store: accountpg.NewStore(counter)},
	})
	if err != nil {
		t.Fatalf("twinkle.NewService: %v", err)
	}
	memoryStore := memorypg.NewStore(counter)
	service, err := admin.NewService(admin.ServiceDeps{
		Store:     adminpg.NewStore(counter),
		Directory: adminAccountDirectory{source: platformsupabase.Fake{Accounts: accounts}},
		Twinkle:   adminTwinkleGranter{service: twinkleService},
		MemStats:  adminMemoryStats{store: memoryStore},
		Usage:     adminMeterUsage{meter: ai.NewMeter()},
		Jobs:      adminJobHealth{store: memoryStore},
		Cipher:    secretbox.Disabled{},
		Catalog:   aiProviderCatalog{},
		Models:    adminIntegrationModels{},
	})
	if err != nil {
		t.Fatalf("admin.NewService: %v", err)
	}

	page, err := service.ListUsers(context.Background(), 0, values.AdminUserListPageSize, "")
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(page.Users) != values.AdminUserListPageSize {
		t.Fatalf("users = %d, want %d", len(page.Users), values.AdminUserListPageSize)
	}
	for _, user := range page.Users {
		if user.Balance.Small != values.TwinkleSmallDailyAmount || user.Balance.General != 0 ||
			user.DiaryCount != 0 || user.EpisodicMemoryCount != 0 {
			t.Fatalf("missing-row defaults = %+v, want lazy Twinkle + zero memory counts", user)
		}
	}
	if counter.queries != 4 || counter.queryRow != 0 || counter.execs != 0 {
		t.Fatalf("database calls = Query %d, QueryRow %d, Exec %d; want 4/0/0",
			counter.queries, counter.queryRow, counter.execs)
	}
}
