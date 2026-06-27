package platform

import (
	"context"
	"errors"
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
