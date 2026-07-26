package account

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// Store is the account context's consumer-owned persistence port. The concrete lives in
// account/pg, and no sqlc type crosses this boundary.
type Store interface {
	GetPalettePreference(ctx context.Context, scope platform.UserScope) (paletteID string, found bool, err error)
	UpsertPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error)
	GetUserProfile(ctx context.Context, scope platform.UserScope) (profile Profile, found bool, err error)
	UpdateUserProfile(ctx context.Context, scope platform.UserScope, input UpdateProfileInput) (profile Profile, found bool, err error)
	ListAuthProviders(ctx context.Context, scope platform.UserScope) ([]AuthProvider, error)
	RecordAuthProvider(ctx context.Context, scope platform.UserScope, kind AuthProviderKind, providerUserID string) error
	CountRewardedInvitesByInviter(ctx context.Context, scope platform.UserScope) (int64, error)
}

// Directory is account's narrow view of Supabase Auth. The composition root translates from the
// platform adapter, so this context imports no external SDK or platform DTO.
type Directory interface {
	EmailFor(ctx context.Context, userID string) (string, error)
	Identities(ctx context.Context, userID string) ([]string, error)
}

// InviteSigner computes the keyed MAC used by stateless invite capabilities. Verification
// recomputes the MAC through this same port and compares it in constant time in account behavior.
type InviteSigner interface {
	MAC(payload []byte) ([]byte, error)
}
