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
