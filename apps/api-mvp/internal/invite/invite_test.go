package invite

import (
	"testing"
	"time"
)

func ptrTime(t time.Time) *time.Time { return &t }
func ptrInt(i int) *int              { return &i }

// evaluate is the single validity oracle shared by Validate and the locked Redeem. This pins the
// orthogonal model + precedence (revoked > expired > exhausted) that A5/A6/A7/A9 rely on.
func TestEvaluate(t *testing.T) {
	now := time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)

	cases := []struct {
		name string
		code InviteCode
		want Reason
	}{
		{"unlimited active", InviteCode{}, ReasonOK},
		{"one-time unused", InviteCode{MaxUses: ptrInt(1), UsedCount: 0}, ReasonOK},
		{"one-time used", InviteCode{MaxUses: ptrInt(1), UsedCount: 1}, ReasonExhausted},
		{"multi under cap", InviteCode{MaxUses: ptrInt(3), UsedCount: 2}, ReasonOK},
		{"multi at cap", InviteCode{MaxUses: ptrInt(3), UsedCount: 3}, ReasonExhausted},
		{"timed before expiry", InviteCode{ExpiresAt: ptrTime(future)}, ReasonOK},
		{"timed after expiry", InviteCode{ExpiresAt: ptrTime(past)}, ReasonExpired},
		{"revoked beats all", InviteCode{RevokedAt: ptrTime(past), ExpiresAt: ptrTime(past), MaxUses: ptrInt(1), UsedCount: 1}, ReasonRevoked},
		{"expired beats exhausted", InviteCode{ExpiresAt: ptrTime(past), MaxUses: ptrInt(1), UsedCount: 1}, ReasonExpired},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := evaluate(c.code, now); got != c.want {
				t.Fatalf("evaluate = %v, want %v", got, c.want)
			}
		})
	}
}

func TestStatusDerivation(t *testing.T) {
	now := time.Now()
	if got := (InviteCode{}).Status(now); got != StatusActive {
		t.Fatalf("unlimited active status = %v, want StatusActive", got)
	}
	if got := (InviteCode{RevokedAt: ptrTime(now)}).Status(now); got != StatusRevoked {
		t.Fatalf("revoked status = %v, want StatusRevoked", got)
	}
}

func TestNormalize(t *testing.T) {
	cases := map[string]string{
		"abcd2345":    "ABCD2345",
		"abcd-2345":   "ABCD2345",
		" ABCD 2345 ": "ABCD2345",
		"ab_cd\t2345": "ABCD2345",
	}
	for in, want := range cases {
		if got := normalize(in); got != want {
			t.Fatalf("normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

// newCode must draw only from the unambiguous alphabet and honor the requested length.
func TestNewCode(t *testing.T) {
	code, err := newCode(8)
	if err != nil {
		t.Fatalf("newCode: %v", err)
	}
	if len(code) != 8 {
		t.Fatalf("newCode length = %d, want 8", len(code))
	}
	for _, r := range code {
		if !containsRune(codeAlphabet, r) {
			t.Fatalf("newCode produced out-of-alphabet rune %q in %q", r, code)
		}
	}
}

func containsRune(s string, r rune) bool {
	for _, c := range s {
		if c == r {
			return true
		}
	}
	return false
}
