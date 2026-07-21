package rpc

import (
	"context"
	"errors"
	"strings"
	"testing"

	"connectrpc.com/connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/twinkle"
)

func TestEarnHandlersRejectUnauthenticatedRequestsBeforeTrustProcessing(t *testing.T) {
	t.Parallel()
	server := &Server{}
	receipt := "private-provider-receipt"

	_, chargeErr := server.Charge(context.Background(), connect.NewRequest(&twinklev1.ChargeRequest{
		PackId:   twinkle.DefaultChargePackID,
		Platform: "app-store",
		Receipt:  receipt,
	}))
	if connect.CodeOf(chargeErr) != connect.CodeUnauthenticated {
		t.Fatalf("Charge code = %v, want unauthenticated", connect.CodeOf(chargeErr))
	}
	if strings.Contains(chargeErr.Error(), receipt) {
		t.Fatal("unauthenticated Charge error exposed the receipt body")
	}

	_, inviteErr := server.ClaimInvite(context.Background(), connect.NewRequest(&twinklev1.ClaimInviteRequest{
		InviteCode: "private-invite-code",
	}))
	if connect.CodeOf(inviteErr) != connect.CodeUnauthenticated {
		t.Fatalf("ClaimInvite code = %v, want unauthenticated", connect.CodeOf(inviteErr))
	}
}

func TestDomainErrorMapsTrustBoundaryRefusals(t *testing.T) {
	t.Parallel()
	cases := []struct {
		err  error
		want connect.Code
	}{
		{twinkle.ErrPaymentVerificationUnavailable, connect.CodeUnavailable},
		{twinkle.ErrInviteResolutionUnavailable, connect.CodeUnavailable},
		{twinkle.ErrPaymentBeneficiaryMismatch, connect.CodePermissionDenied},
		{twinkle.ErrInviteBeneficiaryMismatch, connect.CodePermissionDenied},
		{twinkle.ErrPaymentNotVerified, connect.CodeFailedPrecondition},
		{twinkle.ErrInviteNotEligible, connect.CodeFailedPrecondition},
		{twinkle.ErrInviteGrantConflict, connect.CodeFailedPrecondition},
	}
	for _, test := range cases {
		if got := connect.CodeOf(domainError(test.err)); got != test.want {
			t.Fatalf("domainError(%v) = %v, want %v", test.err, got, test.want)
		}
	}
	other := errors.New("boom")
	if got := domainError(other); !errors.Is(got, other) {
		t.Fatalf("unknown error should pass through, got %v", got)
	}
}
