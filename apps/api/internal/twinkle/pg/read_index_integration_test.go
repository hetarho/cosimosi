package pg

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/testdb"
)

// The ledger page is a per-user keyset walk; its index must serve the order so the page is an index
// scan plus a limit rather than a sort of the whole history.
func TestLedgerPageUsesItsIndex(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	plan, err := testdb.Plan(ctx, pool.PgxPool(), `SELECT id, kind, reason, amount, from_basic, from_additional, created_at
		FROM twinkle_ledger_entries
		WHERE user_id = $1
		  AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::text))
		ORDER BY created_at DESC, id DESC
		LIMIT $4`, "plan-user", time.Now(), "cursor", 20)
	if err != nil {
		t.Fatalf("plan failed: %v", err)
	}
	if !strings.Contains(plan, "twinkle_ledger_entries_user_page_idx") || strings.Contains(plan, "Sort") {
		t.Fatalf("ledger page plan does not walk twinkle_ledger_entries_user_page_idx in order:\n%s", plan)
	}
}
