package twinkle

import (
	"context"
)

// UnavailableInviteResolver is the production-safe default while no trusted
// account/signup resolver is configured. An opaque code alone carries no value.
type UnavailableInviteResolver struct{}

func (UnavailableInviteResolver) Resolve(context.Context, InviteResolutionRequest) (ResolvedSignup, error) {
	return ResolvedSignup{}, ErrInviteResolutionUnavailable
}
