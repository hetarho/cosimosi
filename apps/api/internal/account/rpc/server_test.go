package rpc

import (
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/platform/apperr"
)

func TestDomainErrorMapsAccountErrors(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{account.ErrUnknownPaletteID, connect.CodeInvalidArgument, reasonUnknownPalette},
		{account.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
	} {
		got := domainError(testCase.err)
		info, ok := apperr.Info(got)
		if connect.CodeOf(got) != testCase.wantCode || !ok || info.GetReason() != testCase.wantReason || info.GetDomain() != "account" {
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
