package rpc

import (
	"context"
	"errors"
	"strings"
	"testing"

	"connectrpc.com/connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/platform/apperr"
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
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{twinkle.ErrInviteInputRequired, connect.CodeInvalidArgument, reasonInviteInputRequired},
		{twinkle.ErrChargeInputRequired, connect.CodeInvalidArgument, reasonChargeInputRequired},
		{twinkle.ErrQuoteInputRequired, connect.CodeInvalidArgument, reasonQuoteInputRequired},
		{twinkle.ErrQuoteTargetNotFound, connect.CodeNotFound, reasonQuoteTargetNotFound},
		{twinkle.ErrInsufficientTwinkle, connect.CodeResourceExhausted, reasonInsufficient},
		{twinkle.ErrPaymentVerificationUnavailable, connect.CodeUnavailable, reasonPaymentVerificationUnavailable},
		{twinkle.ErrInviteResolutionUnavailable, connect.CodeUnavailable, reasonInviteResolutionUnavailable},
		{twinkle.ErrPaymentBeneficiaryMismatch, connect.CodePermissionDenied, reasonPaymentBeneficiaryMismatch},
		{twinkle.ErrInviteBeneficiaryMismatch, connect.CodePermissionDenied, reasonInviteBeneficiaryMismatch},
		{twinkle.ErrPaymentNotVerified, connect.CodeFailedPrecondition, reasonPaymentNotVerified},
		{twinkle.ErrInviteNotEligible, connect.CodeFailedPrecondition, reasonInviteNotEligible},
		{twinkle.ErrInviteGrantConflict, connect.CodeFailedPrecondition, reasonInviteGrantConflict},
		{twinkle.ErrQuoteTargetUnavailable, connect.CodeFailedPrecondition, reasonQuoteTargetUnavailable},
		{twinkle.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
	}
	for _, test := range cases {
		got := domainError(test.err)
		if gotCode := connect.CodeOf(got); gotCode != test.wantCode {
			t.Fatalf("domainError(%v) code = %v, want %v", test.err, gotCode, test.wantCode)
		}
		info, ok := apperr.Info(got)
		if !ok || info.GetReason() != test.wantReason || info.GetDomain() != "twinkle" {
			t.Fatalf("domainError(%v) info = %#v, want reason %q", test.err, info, test.wantReason)
		}
	}
	other := errors.New("boom")
	got := domainError(other)
	info, ok := apperr.Info(got)
	if connect.CodeOf(got) != connect.CodeInternal || !ok || info.GetReason() != apperr.ReasonInternal || !errors.Is(got, other) {
		t.Fatalf("unknown error should be internal and retain its cause, got %v", got)
	}
}
