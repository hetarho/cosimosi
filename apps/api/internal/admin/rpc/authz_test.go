package rpc

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
)

func TestAuthorizationInterceptorReturnsStructuredErrors(t *testing.T) {
	t.Parallel()

	authorizerFailure := errors.New("admin lookup failed")
	for _, testCase := range []struct {
		name       string
		ctx        context.Context
		authorizer Authorizer
		wantCode   connect.Code
		wantReason string
		wantCause  error
	}{
		{
			name:       "anonymous",
			ctx:        context.Background(),
			authorizer: stubAuthorizer{},
			wantCode:   connect.CodeUnauthenticated,
			wantReason: apperr.ReasonPlatformUnauthenticated,
		},
		{
			name:       "non-admin",
			ctx:        platform.ContextWithUserID(context.Background(), "user-1"),
			authorizer: stubAuthorizer{},
			wantCode:   connect.CodePermissionDenied,
			wantReason: reasonForbidden,
		},
		{
			name:       "lookup failure",
			ctx:        platform.ContextWithUserID(context.Background(), "user-1"),
			authorizer: stubAuthorizer{err: authorizerFailure},
			wantCode:   connect.CodeInternal,
			wantReason: apperr.ReasonInternal,
			wantCause:  authorizerFailure,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			nextCalled := false
			next := func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
				nextCalled = true
				return connect.NewResponse(&struct{}{}), nil
			}
			_, err := AuthorizationInterceptor(testCase.authorizer)(next)(
				testCase.ctx,
				connect.NewRequest(&struct{}{}),
			)
			if err == nil {
				t.Fatal("interceptor unexpectedly succeeded")
			}
			if nextCalled {
				t.Fatal("interceptor called next after denying request")
			}
			info, ok := apperr.Info(err)
			if connect.CodeOf(err) != testCase.wantCode || !ok || info.GetReason() != testCase.wantReason {
				t.Fatalf("error = code %s info %#v", connect.CodeOf(err), info)
			}
			if testCase.wantCause != nil && !errors.Is(err, testCase.wantCause) {
				t.Fatalf("error %v does not retain cause %v", err, testCase.wantCause)
			}
		})
	}
}

func TestAuthorizationInterceptorAllowsAdmin(t *testing.T) {
	t.Parallel()

	nextCalled := false
	next := func(context.Context, connect.AnyRequest) (connect.AnyResponse, error) {
		nextCalled = true
		return connect.NewResponse(&struct{}{}), nil
	}
	_, err := AuthorizationInterceptor(stubAuthorizer{isAdmin: true})(next)(
		platform.ContextWithUserID(context.Background(), "admin-1"),
		connect.NewRequest(&struct{}{}),
	)
	if err != nil {
		t.Fatalf("interceptor failed: %v", err)
	}
	if !nextCalled {
		t.Fatal("interceptor did not call next")
	}
}

type stubAuthorizer struct {
	isAdmin bool
	err     error
}

func (a stubAuthorizer) IsAdmin(context.Context, string) (bool, error) {
	return a.isAdmin, a.err
}
