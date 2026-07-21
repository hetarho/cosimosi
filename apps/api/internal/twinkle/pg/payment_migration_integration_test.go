package pg

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestPaymentUniquenessMigrationPreflightAndRoundTrip(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	conn, err := pool.PgxPool().Acquire(ctx)
	if err != nil {
		t.Fatalf("Acquire failed: %v", err)
	}
	defer conn.Release()

	ledgerMigration := readMigrationSection(t, "../../../db/migrations/00007_twinkle_ledger.sql", "up")
	guardMigration := readMigrationSection(t, "../../../db/migrations/00010_twinkle_payment_transaction_uniqueness.sql", "up")
	guardDown := readMigrationSection(t, "../../../db/migrations/00010_twinkle_payment_transaction_uniqueness.sql", "down")

	preflightSchema := fmt.Sprintf("test_twinkle_payment_preflight_%d", time.Now().UnixNano())
	withMigrationSchema(t, ctx, conn.Conn(), preflightSchema, func() {
		if _, err := conn.Exec(ctx, ledgerMigration); err != nil {
			t.Fatalf("apply ledger migration failed: %v", err)
		}
		if _, err := conn.Exec(ctx, `
			INSERT INTO twinkle_ledger_entries (id, user_id, kind, reason, amount, dedup_key)
			VALUES ('entry-1', 'user-1', 'earn', 'payment', 1, 'payment:historical-duplicate'),
			       ('entry-2', 'user-2', 'earn', 'payment', 1, 'payment:historical-duplicate')`); err != nil {
			t.Fatalf("seed duplicate history failed: %v", err)
		}
		_, err := conn.Exec(ctx, guardMigration)
		if err == nil || !strings.Contains(err.Error(), "investigate duplicate append-only ledger keys") {
			t.Fatalf("preflight err = %v, want actionable duplicate-history refusal", err)
		}
	})

	roundTripSchema := fmt.Sprintf("test_twinkle_payment_roundtrip_%d", time.Now().UnixNano())
	withMigrationSchema(t, ctx, conn.Conn(), roundTripSchema, func() {
		if _, err := conn.Exec(ctx, ledgerMigration); err != nil {
			t.Fatalf("apply ledger migration failed: %v", err)
		}
		if _, err := conn.Exec(ctx, guardMigration); err != nil {
			t.Fatalf("payment migration up failed: %v", err)
		}
		assertIndexPresent(t, ctx, conn.Conn(), true)
		if _, err := conn.Exec(ctx, guardDown); err != nil {
			t.Fatalf("payment migration down failed: %v", err)
		}
		assertIndexPresent(t, ctx, conn.Conn(), false)
		if _, err := conn.Exec(ctx, guardMigration); err != nil {
			t.Fatalf("payment migration second up failed: %v", err)
		}
		assertIndexPresent(t, ctx, conn.Conn(), true)
	})
}

func withMigrationSchema(t *testing.T, ctx context.Context, conn *pgx.Conn, schema string, run func()) {
	t.Helper()
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := conn.Exec(ctx, "CREATE SCHEMA "+identifier); err != nil {
		t.Fatalf("create migration schema failed: %v", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), "SET search_path TO public")
		_, _ = conn.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
	}()
	if _, err := conn.Exec(ctx, "SET search_path TO "+identifier); err != nil {
		t.Fatalf("set migration search_path failed: %v", err)
	}
	run()
}

func assertIndexPresent(t *testing.T, ctx context.Context, conn *pgx.Conn, want bool) {
	t.Helper()
	var present bool
	if err := conn.QueryRow(ctx, `
		SELECT to_regclass(current_schema() || '.twinkle_ledger_payment_transaction_key_unique') IS NOT NULL`).Scan(&present); err != nil {
		t.Fatalf("inspect payment index failed: %v", err)
	}
	if present != want {
		t.Fatalf("payment uniqueness index present = %t, want %t", present, want)
	}
}

func readMigrationSection(t *testing.T, path string, section string) string {
	t.Helper()
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read migration %s failed: %v", path, err)
	}
	text := string(contents)
	upMarker := "-- +goose Up"
	downMarker := "-- +goose Down"
	up := strings.Index(text, upMarker)
	down := strings.Index(text, downMarker)
	if up < 0 || down < 0 || down <= up {
		t.Fatalf("migration %s has invalid goose sections", path)
	}
	switch section {
	case "up":
		return text[up+len(upMarker) : down]
	case "down":
		return text[down+len(downMarker):]
	default:
		t.Fatalf("unknown migration section %q", section)
		return ""
	}
}
