package pg

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/testdb"
)

// The launch's persist-time dedup matches lowered names among one user's live neurons inside the
// graph lock; it must be an index scan, not a scan of the user's whole graph.
func TestNeuronNameLookupUsesItsIndex(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	plan, err := testdb.Plan(ctx, pool.PgxPool(), `SELECT id, name, neuron_type, representation_revision
		FROM neurons
		WHERE user_id = $1 AND sealed_at IS NULL AND name IS NOT NULL AND LOWER(name) = ANY($2::text[])
		ORDER BY id`, "plan-user", []string{"harbor"})
	if err != nil {
		t.Fatalf("plan failed: %v", err)
	}
	if !strings.Contains(plan, "neurons_user_lower_name_idx") {
		t.Fatalf("name lookup plan does not use neurons_user_lower_name_idx:\n%s", plan)
	}
}
