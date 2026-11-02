package platform

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/cosimosi/api/internal/platform/apperr"
)

type UserScope struct {
	userID string
}

func NewUserScope(userID string) (UserScope, error) {
	if userID == "" {
		return UserScope{}, errors.New("user scope requires a user id")
	}
	return UserScope{userID: userID}, nil
}

func UserScopeFromContext(ctx context.Context) (UserScope, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return UserScope{}, errors.New("user scope requires an authenticated request context")
	}
	return UserScope{userID: userID}, nil
}

func (s UserScope) UserID() string {
	return s.userID
}

// RequireUserScope is the authenticated caller's scope for an RPC handler, or the canonical
// Unauthenticated refusal when the auth interceptor attached none.
func RequireUserScope(ctx context.Context) (UserScope, error) {
	scope, err := UserScopeFromContext(ctx)
	if err != nil {
		return UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}
