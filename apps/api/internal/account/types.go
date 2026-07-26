package account

import "time"

// Profile is the product-owned portion of a User. Email remains in Supabase Auth and is joined
// only at the published read boundary.
type Profile struct {
	UserID    string
	Nickname  string
	Timezone  string
	Locale    string
	CreatedAt time.Time
	DeletedAt *time.Time
}

type ProfileView struct {
	Profile Profile
	Email   string
}

type UpdateProfileInput struct {
	Nickname string
	Timezone string
	Locale   string
}

type SignUpInput struct {
	Nickname    string
	Timezone    string
	Locale      string
	InviteToken string
}

type AuthProviderKind string

const (
	AuthProviderGoogle   AuthProviderKind = "GOOGLE"
	AuthProviderPassword AuthProviderKind = "PASSWORD"
)

type AuthProvider struct {
	Kind           AuthProviderKind
	ProviderUserID string
	LinkedAt       time.Time
}

type InviteLink struct {
	Token     string
	ExpiresAt time.Time
}

type VerifiedInviteToken struct {
	InviterUserID string
	IssuedAt      time.Time
	Token         string
}

// Invite is the bound capability fact. A row is born only when a verified link is accepted.
type Invite struct {
	ID            string
	InviterUserID string
	InviteeUserID string
	Token         string
	CreatedAt     time.Time
	BoundAt       time.Time
}

// SettleableInvite is the minimum relationship identity needed by deferred settlement.
type SettleableInvite struct {
	InviteID      string
	InviterUserID string
	InviteeUserID string
	Token         string
}

type InviteSettlementRequest struct {
	Token         string
	InviteeUserID string
}

type SettledInvite struct {
	InviteID      string
	InviterUserID string
	InviteeUserID string
}
