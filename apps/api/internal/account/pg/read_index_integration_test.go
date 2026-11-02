package pg

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/testdb"
)

// An inviter's rewarded-invite count is read inside every settlement; it filters by the inviter.
func TestInviterCountUsesItsIndex(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	plan, err := testdb.Plan(ctx, pool.PgxPool(), `SELECT count(*) FROM invites WHERE user_id = $1 AND rewarded_at IS NOT NULL`, "plan-user")
	if err != nil {
		t.Fatalf("plan failed: %v", err)
	}
	if !strings.Contains(plan, "invites_user_idx") {
		t.Fatalf("inviter count plan does not use invites_user_idx:\n%s", plan)
	}
}
