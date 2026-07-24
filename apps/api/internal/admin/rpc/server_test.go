package rpc

import (
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/admin"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/platform/secretbox"
)

func TestDomainErrorMapsAdminErrors(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{admin.ErrSeedAdminUndemotable, connect.CodeFailedPrecondition, reasonSeedAdminUndemotable},
		{admin.ErrUserIDRequired, connect.CodeInvalidArgument, reasonUserIDRequired},
		{admin.ErrGrantAmountRange, connect.CodeInvalidArgument, reasonGrantAmountRange},
		{admin.ErrGrantIDRequired, connect.CodeInvalidArgument, reasonGrantIDRequired},
		{admin.ErrUnknownCapability, connect.CodeInvalidArgument, reasonUnknownCapability},
		{admin.ErrProviderRequired, connect.CodeInvalidArgument, reasonProviderRequired},
		{admin.ErrProviderKeyRequired, connect.CodeInvalidArgument, reasonProviderKeyRequired},
		{admin.ErrUnknownProvider, connect.CodeInvalidArgument, reasonUnknownProvider},
		{admin.ErrProviderCapabilityMismatch, connect.CodeInvalidArgument, reasonProviderCapabilityMismatch},
		{admin.ErrProviderNotImplemented, connect.CodeFailedPrecondition, reasonProviderNotImplemented},
		{admin.ErrProviderKeyMissing, connect.CodeFailedPrecondition, reasonProviderKeyMissing},
		{secretbox.ErrDisabled, connect.CodeFailedPrecondition, reasonSecretboxDisabled},
	} {
		got := domainError(testCase.err)
		info, ok := apperr.Info(got)
		if connect.CodeOf(got) != testCase.wantCode || !ok || info.GetReason() != testCase.wantReason || info.GetDomain() != "admin" {
			t.Fatalf("domainError(%v) = code %s info %#v", testCase.err, connect.CodeOf(got), info)
		}
	}

	cause := errors.New("database exploded")
	got := domainError(cause)
	info, ok := apperr.Info(got)
	if connect.CodeOf(got) != connect.CodeInternal || !ok || info.GetReason() != apperr.ReasonInternal || !errors.Is(got, cause) {
		t.Fatalf("unknown error should be internal and retain its cause, got %v", got)
	}
}
