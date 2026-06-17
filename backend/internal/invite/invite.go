// Package invite is the invite-code membership gate (spec 41): a removable, closed-beta gate
// layered on top of real auth (spec 01). A user redeems a valid code ONCE to become a MEMBER;
// the core universe services then accept their calls (enforced by the membership interceptor in
// rpcserver). Codes are an orthogonal model — max_uses (nil = unlimited) × expires_at (nil =
// never) — with the UI presets (one-time/timed/unlimited) just being combinations.
//
// Domain types here are pure values — no json/db/proto tags (constitution §5). The whole package
// + the two tables + the proto contract are a removable unit (the beta gate disappears with them;
// INVITE_GATE_ENABLED toggles enforcement meanwhile).
package invite

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"math/big"
	"strings"
	"time"
)

// Validation / control sentinels — the handler maps these to Connect codes (spec-17 pattern).
var (
	// ErrInvalidMaxUses rejects a non-positive use cap at issuance (the DB CHECK is the backstop).
	ErrInvalidMaxUses = errors.New("invite: max_uses must be greater than 0")
	// ErrInvalidTTL rejects a non-positive TTL at issuance — a past/zero expiry would mint an
	// immediately-unredeemable code (mirror of the max_uses guard).
	ErrInvalidTTL = errors.New("invite: ttl must be greater than 0")
	// ErrNotFound is returned when revoking a code that does not exist.
	ErrNotFound = errors.New("invite: code not found")
)

// idBytes is 16 bytes = 128 bits of entropy → 22 base64url chars for the internal row id (the
// spec-35 slug convention). Distinct from the human-enterable `code`.
const idBytes = 16

// codeAlphabet is the human-enterable code charset: uppercase letters + digits with the visually
// ambiguous ones removed (no 0/O, 1/I/L) so a code is easy to read aloud and type. This is code
// CONTENT (like the theme/mood tables) — it lives here, not in values.yaml (which holds only
// tuning scalars; the code LENGTH is the scalar, values.InviteCodeLength).
const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// Reason is why a validate/redeem succeeded or failed (mapped to proto InviteReason by the
// handler and returned as a response field, not an RPC error).
type Reason int

const (
	ReasonOK Reason = iota
	ReasonNotFound
	ReasonExpired
	ReasonExhausted
	ReasonRevoked
)

// Status is the admin-list lifecycle state, derived at read time from a code's columns.
type Status int

const (
	StatusActive Status = iota
	StatusExpired
	StatusExhausted
	StatusRevoked
)

// InviteCode is one code. ExpiresAt/MaxUses/RevokedAt are pointers so nil cleanly means
// "never / unlimited / not revoked" (the orthogonal model's two open axes + the revoke flag).
type InviteCode struct {
	ID        string
	Code      string
	Label     string
	CreatedBy string
	CreatedAt time.Time
	ExpiresAt *time.Time // nil = never expires
	MaxUses   *int       // nil = unlimited; 1 = one-time
	UsedCount int
	RevokedAt *time.Time // nil = active
}

// Status derives the lifecycle state for the admin list (revoked > expired > exhausted > active).
func (c InviteCode) Status(now time.Time) Status {
	switch evaluate(c, now) {
	case ReasonRevoked:
		return StatusRevoked
	case ReasonExpired:
		return StatusExpired
	case ReasonExhausted:
		return StatusExhausted
	default:
		return StatusActive
	}
}

// IssueParams is the admin issuance input. MaxUses nil = unlimited; TTL nil = never expires.
type IssueParams struct {
	Label     string
	MaxUses   *int
	TTL       *time.Duration
	CreatedBy string
}

// RedeemOutcome is the result of a redeem attempt. AlreadyMember marks the idempotent re-redeem
// (a member who calls again succeeds without consuming a use).
type RedeemOutcome struct {
	Reason        Reason
	AlreadyMember bool
}

// OK reports whether the redeem granted (or confirmed) membership.
func (o RedeemOutcome) OK() bool { return o.Reason == ReasonOK }

// Repository is the persistence port (pgx/sqlc impl in repository_pg.go).
type Repository interface {
	// Issue inserts a fully-formed code (id/code/expires_at/max_uses already computed) and
	// returns the stored row.
	Issue(ctx context.Context, c InviteCode) (InviteCode, error)
	// GetByCode reads a code for non-consuming validation; ok=false when no such code.
	GetByCode(ctx context.Context, code string) (InviteCode, bool, error)
	// Redeem atomically validates + consumes a code and grants membership (FOR UPDATE lock).
	// Idempotent: an already-member caller returns {ReasonOK, AlreadyMember:true} without
	// consuming. An invalid code returns the reason with nothing consumed.
	Redeem(ctx context.Context, code, userID string, now time.Time) (RedeemOutcome, error)
	// IsMember reports whether the user has redeemed any code (the gate predicate).
	IsMember(ctx context.Context, userID string) (bool, error)
	// List returns all codes, newest first (admin surface).
	List(ctx context.Context) ([]InviteCode, error)
	// Revoke marks a code revoked; ok=false when no such code.
	Revoke(ctx context.Context, id string) (InviteCode, bool, error)
}

// evaluate is the single source of validity truth, shared by Validate (read-only) and Redeem
// (inside the locked tx). Precedence: revoked > expired > exhausted.
func evaluate(c InviteCode, now time.Time) Reason {
	switch {
	case c.RevokedAt != nil:
		return ReasonRevoked
	case c.ExpiresAt != nil && !c.ExpiresAt.After(now):
		return ReasonExpired
	case c.MaxUses != nil && c.UsedCount >= *c.MaxUses:
		return ReasonExhausted
	default:
		return ReasonOK
	}
}

// normalize canonicalizes a typed code for comparison: uppercase, separators/whitespace dropped
// (so "abcd-2345" and "ABCD 2345" both match the stored "ABCD2345").
func normalize(code string) string {
	var b strings.Builder
	b.Grow(len(code))
	for _, r := range strings.ToUpper(code) {
		switch r {
		case ' ', '\t', '\n', '\r', '-', '_':
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// newID returns 128 bits of crypto entropy as 22 base64url chars (the spec-35 slug convention).
func newID() (string, error) {
	var b [idBytes]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// newCode returns an n-char human-enterable code drawn uniformly from codeAlphabet via crypto/rand
// (rejection-free: crypto/rand.Int is unbiased over [0, len)).
func newCode(n int) (string, error) {
	if n <= 0 {
		n = 1
	}
	b := make([]byte, n)
	max := big.NewInt(int64(len(codeAlphabet)))
	for i := range b {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = codeAlphabet[idx.Int64()]
	}
	return string(b), nil
}
