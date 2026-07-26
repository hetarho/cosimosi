package account

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Store is the account context's consumer-owned persistence port. The concrete lives in
// account/pg, and no sqlc type crosses this boundary.
type Store interface {
	InSignupTx(ctx context.Context, fn func(Store) error) error
	WithInviteSettlementLock(ctx context.Context, inviterScope platform.UserScope, fn func() error) error
	GetPalettePreference(ctx context.Context, scope platform.UserScope) (paletteID string, found bool, err error)
	UpsertPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error)
	GetUserProfile(ctx context.Context, scope platform.UserScope) (profile Profile, found bool, err error)
	CreateUserIfAbsent(ctx context.Context, scope platform.UserScope, input SignUpInput, provider *AuthProvider) (profile Profile, created bool, err error)
	UpdateUserProfile(ctx context.Context, scope platform.UserScope, input UpdateProfileInput) (profile Profile, found bool, err error)
	ListAuthProviders(ctx context.Context, scope platform.UserScope) ([]AuthProvider, error)
	RecordAuthProvider(ctx context.Context, scope platform.UserScope, kind AuthProviderKind, providerUserID string) error
	BindInviteToInvitee(ctx context.Context, inviteeScope platform.UserScope, invite Invite) (bool, error)
	FindSettleableInviteForInvitee(ctx context.Context, inviteeScope platform.UserScope) (*SettleableInvite, error)
	CountRewardedInvitesByInviter(ctx context.Context, scope platform.UserScope) (int64, error)
	MarkInviteRewarded(ctx context.Context, inviterScope platform.UserScope, inviteID string, rewardedAt time.Time) error
}

// Directory is account's narrow view of Supabase Auth. The composition root translates from the
// platform adapter, so this context imports no external SDK or platform DTO.
type Directory interface {
	EmailFor(ctx context.Context, userID string) (string, error)
	EmailVerifiedAt(ctx context.Context, userID string) (time.Time, error)
	Identities(ctx context.Context, userID string) ([]string, error)
}

// InviteSigner computes the keyed MAC used by stateless invite capabilities. Verification
// recomputes the MAC through this same port and compares it in constant time in account behavior.
type InviteSigner interface {
	MAC(payload []byte) ([]byte, error)
}

// InviteRewardGranter is account's consumer-owned view of the paired invite credit. The token
// is opaque at this edge; only the authenticated invitee scope accompanies it.
type InviteRewardGranter interface {
	Grant(ctx context.Context, scope platform.UserScope, token string) error
}

// SignupBonusGranter is the one-time onboarding credit seam. No amount is expressible here.
type SignupBonusGranter interface {
	Grant(ctx context.Context, scope platform.UserScope) error
}
