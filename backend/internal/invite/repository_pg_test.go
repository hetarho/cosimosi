package invite

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestRepository_Integration exercises the real SQL + tx (FOR UPDATE) against Postgres, covering
// the redeem matrix that pure unit tests can't: atomic consume, idempotency, expiry, exhaustion,
// revoke, membership, and the admin list (acceptance A5–A10). Skips without DATABASE_URL (so
// `go test ./...` stays green in DB-less environments); the dev container has it set.
func TestRepository_Integration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set — skipping invite DB integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("db connect failed (%v) — skipping", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("db unreachable (%v) — skipping", err)
	}

	repo := NewRepository(pool)
	now := time.Now()

	var codeIDs, userIDs []string
	t.Cleanup(func() {
		// invite_redemptions FK → invite_codes, so delete redemptions first. Test-only rows
		// (random ids/users) — invite tables are not records/memories (constitution §1/2 untouched).
		for _, u := range userIDs {
			_, _ = pool.Exec(ctx, "DELETE FROM invite_redemptions WHERE user_id = $1", u)
		}
		for _, id := range codeIDs {
			_, _ = pool.Exec(ctx, "DELETE FROM invite_codes WHERE id = $1", id)
		}
	})

	issue := func(c InviteCode) InviteCode {
		t.Helper()
		id, _ := newID()
		code, _ := newCode(10)
		c.ID, c.Code, c.CreatedBy = id, code, "test-admin"
		out, err := repo.Issue(ctx, c)
		if err != nil {
			t.Fatalf("issue: %v", err)
		}
		codeIDs = append(codeIDs, out.ID)
		return out
	}
	newUser := func() string {
		id, _ := newID()
		u := "test-invite-" + id
		userIDs = append(userIDs, u)
		return u
	}
	redeem := func(code, user string) RedeemOutcome {
		t.Helper()
		out, err := repo.Redeem(ctx, code, user, now)
		if err != nil {
			t.Fatalf("redeem: %v", err)
		}
		return out
	}

	// A5/A8: one-time — first redeem consumes, same user is idempotent, a different user is exhausted.
	one := issue(InviteCode{MaxUses: ptrInt(1)})
	uA := newUser()
	if out := redeem(one.Code, uA); out.Reason != ReasonOK || out.AlreadyMember {
		t.Fatalf("A5 first redeem = %+v, want OK (new)", out)
	}
	if out := redeem(one.Code, uA); out.Reason != ReasonOK || !out.AlreadyMember {
		t.Fatalf("A8 idempotent re-redeem = %+v, want OK (already member)", out)
	}
	if out := redeem(one.Code, newUser()); out.Reason != ReasonExhausted {
		t.Fatalf("A5 second user = %v, want EXHAUSTED", out.Reason)
	}

	// A6: expired (expires_at in the past).
	past := now.Add(-time.Hour)
	if out := redeem(issue(InviteCode{ExpiresAt: &past}).Code, newUser()); out.Reason != ReasonExpired {
		t.Fatalf("A6 expired = %v, want EXPIRED", out.Reason)
	}

	// A9: revoked.
	rev := issue(InviteCode{})
	if _, ok, err := repo.Revoke(ctx, rev.ID); err != nil || !ok {
		t.Fatalf("revoke: err=%v ok=%v", err, ok)
	}
	if out := redeem(rev.Code, newUser()); out.Reason != ReasonRevoked {
		t.Fatalf("A9 revoked = %v, want REVOKED", out.Reason)
	}

	// A7: unlimited admits a fresh user.
	if out := redeem(issue(InviteCode{}).Code, newUser()); out.Reason != ReasonOK {
		t.Fatalf("A7 unlimited = %v, want OK", out.Reason)
	}

	// A8 (cross-code): a user who is already a member redeeming a DIFFERENT code is idempotent —
	// OK + AlreadyMember, with NO error (PK violation) and NO consumption of the second code. This
	// is the deterministic form of the concurrent-different-code race the ON CONFLICT insert guards.
	first := issue(InviteCode{})
	uX := newUser()
	if out := redeem(first.Code, uX); out.Reason != ReasonOK || out.AlreadyMember {
		t.Fatalf("A8 first redeem(uX) = %+v, want OK (new)", out)
	}
	second := issue(InviteCode{})
	if out := redeem(second.Code, uX); out.Reason != ReasonOK || !out.AlreadyMember {
		t.Fatalf("A8 same-user second (different) code = %+v, want OK (already member)", out)
	}
	afterList, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("list after cross-code redeem: %v", err)
	}
	for _, c := range afterList {
		if c.ID == second.ID && c.UsedCount != 0 {
			t.Fatalf("A8 second code used_count = %d, want 0 (not consumed by an already-member)", c.UsedCount)
		}
	}

	// A4: membership reflects redemption.
	if m, _ := repo.IsMember(ctx, uA); !m {
		t.Fatalf("IsMember(redeemed user) = false, want true")
	}
	if m, _ := repo.IsMember(ctx, "test-invite-nobody-"+func() string { id, _ := newID(); return id }()); m {
		t.Fatalf("IsMember(unknown) = true, want false")
	}

	// A10: list carries the issued code's fields (used_count, max_uses, status, issuer).
	list, err := repo.List(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	var got *InviteCode
	for i := range list {
		if list[i].ID == one.ID {
			got = &list[i]
			break
		}
	}
	if got == nil {
		t.Fatal("A10 list missing the issued one-time code")
	}
	if got.MaxUses == nil || *got.MaxUses != 1 || got.UsedCount != 1 || got.CreatedBy != "test-admin" {
		t.Fatalf("A10 list fields = %+v", *got)
	}
	if got.Status(now) != StatusExhausted {
		t.Fatalf("A10 one-time used status = %v, want StatusExhausted", got.Status(now))
	}
}
