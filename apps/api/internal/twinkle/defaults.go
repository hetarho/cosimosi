package twinkle

import (
	"context"
)

// UnavailablePaymentVerifier is the production-safe default while no store
// adapter is configured. It never inspects or echoes opaque receipt material.
type UnavailablePaymentVerifier struct{}

func (UnavailablePaymentVerifier) Verify(context.Context, PaymentVerificationRequest) (VerifiedPayment, error) {
	return VerifiedPayment{}, ErrPaymentVerificationUnavailable
}

// UnavailableInviteResolver is the production-safe default while no trusted
// account/signup resolver is configured. An opaque code alone carries no value.
type UnavailableInviteResolver struct{}

func (UnavailableInviteResolver) Resolve(context.Context, InviteResolutionRequest) (ResolvedSignup, error) {
	return ResolvedSignup{}, ErrInviteResolutionUnavailable
}
