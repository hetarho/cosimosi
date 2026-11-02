// Package rpctest holds the helpers handler tests share: a request context as the auth interceptor
// leaves it, and Connect-code assertions.
package rpctest

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"

	"github.com/cosimosi/api/internal/platform"
)

// UserID is the caller every handler test authenticates as.
const UserID = "rpc-test-user"

// UserContext is a request context carrying UserID, as the platform auth interceptor attaches it.
func UserContext() context.Context {
	return platform.ContextWithUserID(context.Background(), UserID)
}

// RequireCode fails the test unless err is a Connect error with code.
func RequireCode(t *testing.T, err error, code connect.Code) {
	t.Helper()
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) || connectErr.Code() != code {
		t.Fatalf("error = %v, want Connect code %v", err, code)
	}
}

// Handler is one handler call under test.
type Handler struct {
	Name string
	Call func(ctx context.Context) error
}

// RequireUnauthenticatedWithoutScope asserts every handler refuses a call that carries no user.
func RequireUnauthenticatedWithoutScope(t *testing.T, handlers []Handler) {
	t.Helper()
	for _, handler := range handlers {
		err := handler.Call(context.Background())
		var connectErr *connect.Error
		if !errors.As(err, &connectErr) || connectErr.Code() != connect.CodeUnauthenticated {
			t.Errorf("%s without a user = %v, want Unauthenticated", handler.Name, err)
		}
	}
}
