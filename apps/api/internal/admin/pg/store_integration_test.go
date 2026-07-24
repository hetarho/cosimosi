package pg

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/admin"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// The grant + audit pair is one pgx transaction: a replay records nothing twice, and a failed
// audit append rolls the grant row back — the accountability record can never lag the credit.
func TestRecordGrantTxAtomicityAndIdempotentReplay(t *testing.T) {
	pool := openAdminTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-admin-%d", time.Now().UnixNano())
	cleanupAdminTestRows(t, pool, base)
	store := NewStore(pool.PgxPool())

	grant := admin.TwinkleGrant{
		ID:         base + "-grant-1",
		GrantedBy:  "actor",
		TargetUser: base + "-user",
		Amount:     10,
		Note:       "integration",
	}
	firstAudit := admin.AuditEntry{ID: base + "-audit-1", Actor: "actor", Action: admin.ActionGrantStardust, Target: grant.TargetUser}

	applied, err := store.RecordGrant(ctx, grant, firstAudit)
	if err != nil {
		t.Fatalf("RecordGrant: %v", err)
	}
	if !applied {
		t.Fatal("first RecordGrant applied = false, want true")
	}
	if got := countRows(t, pool, "admin_stardust_grants", grant.ID); got != 1 {
		t.Fatalf("grant rows = %d, want 1", got)
	}
	if got := countRows(t, pool, "admin_audit_log", firstAudit.ID); got != 1 {
		t.Fatalf("audit rows = %d, want 1", got)
	}

	// Idempotent replay: the same grant id records no second grant row and no second audit row.
	replayAudit := admin.AuditEntry{ID: base + "-audit-2", Actor: "actor", Action: admin.ActionGrantStardust, Target: grant.TargetUser}
	applied, err = store.RecordGrant(ctx, grant, replayAudit)
	if err != nil {
		t.Fatalf("RecordGrant(replay): %v", err)
	}
	if applied {
		t.Fatal("replay applied = true, want false")
	}
	if got := countRows(t, pool, "admin_stardust_grants", grant.ID); got != 1 {
		t.Fatalf("grant rows after replay = %d, want 1", got)
	}
	if got := countRows(t, pool, "admin_audit_log", replayAudit.ID); got != 0 {
		t.Fatalf("replay audit rows = %d, want 0 (a replay audits nothing new)", got)
	}

	// Atomicity: an audit append that fails (duplicate audit id) rolls the new grant row back.
	conflicting := admin.TwinkleGrant{
		ID:         base + "-grant-2",
		GrantedBy:  "actor",
		TargetUser: grant.TargetUser,
		Amount:     10,
	}
	if _, err := store.RecordGrant(ctx, conflicting, firstAudit); err == nil {
		t.Fatal("RecordGrant with a duplicate audit id succeeded, want an error")
	}
	if got := countRows(t, pool, "admin_stardust_grants", conflicting.ID); got != 0 {
		t.Fatalf("grant rows after failed audit = %d, want 0 (rolled back)", got)
	}

	// GetGrant reads the recorded row back (the service's replay/conflict check) and reports
	// absence as nil.
	stored, err := store.GetGrant(ctx, grant.ID)
	if err != nil {
		t.Fatalf("GetGrant: %v", err)
	}
	if stored == nil || stored.TargetUser != grant.TargetUser || stored.Amount != grant.Amount {
		t.Fatalf("GetGrant = %+v, want the recorded grant", stored)
	}
	if missing, err := store.GetGrant(ctx, base+"-absent"); err != nil || missing != nil {
		t.Fatalf("GetGrant(absent) = %+v, %v; want nil, nil", missing, err)
	}
}

// The grant and audit tables are append-only at the query layer: no sqlc statement in ANY
// query file UPDATEs/DELETEs/TRUNCATEs them ([I1] spirit) — asserted against the query source
// so a new statement fails here, wherever it is added.
func TestAdminLogQueriesAreAppendOnly(t *testing.T) {
	files, err := filepath.Glob("../../../db/queries/*/*.sql")
	if err != nil || len(files) == 0 {
		t.Fatalf("glob query files: %v (found %d)", err, len(files))
	}
	forbidden := regexp.MustCompile(`(?i)(UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+(\w+\.)?(admin_stardust_grants|admin_audit_log)`)
	for _, file := range files {
		sql, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if match := forbidden.Find(sql); match != nil {
			t.Fatalf("%s mutates an append-only log table: %q", file, match)
		}
	}
}

func countRows(t *testing.T, pool *platformdb.Pool, table string, id string) int {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var count int
	// table is one of two test-owned constants, never external input.
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM "+table+" WHERE id = $1", id).Scan(&count); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return count
}

func openAdminTestPool(t *testing.T) *platformdb.Pool {
	t.Helper()

	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// cleanupAdminTestRows deletes this test run's rows on teardown. Test hygiene only — the system
// itself never deletes grant/audit rows ([I1]); append-only is asserted by
// TestAdminLogQueriesAreAppendOnly.
func cleanupAdminTestRows(t *testing.T, pool *platformdb.Pool, base string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, table := range []string{"admin_stardust_grants", "admin_audit_log"} {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM "+table+" WHERE id LIKE $1", base+"%"); err != nil {
				t.Errorf("cleanup %s: %v", table, err)
			}
		}
	})
}
