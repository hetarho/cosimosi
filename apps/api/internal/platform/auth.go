package platform

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"
)

const authorizationHeader = "Authorization"

var (
	ErrAuthTokenInvalid        = errors.New("auth token invalid")
	ErrAuthVerifierUnavailable = errors.New("auth verifier unavailable")
)

type authUserIDContextKey struct{}

type UserIdentity struct {
	UserID string
}

type AuthTokenVerifier interface {
	VerifyAccessToken(ctx context.Context, token string) (UserIdentity, error)
}

type AuthTokenVerifierFunc func(context.Context, string) (UserIdentity, error)

func (fn AuthTokenVerifierFunc) VerifyAccessToken(ctx context.Context, token string) (UserIdentity, error) {
	return fn(ctx, token)
}

func ContextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, authUserIDContextKey{}, userID)
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(authUserIDContextKey{}).(string)
	return userID, ok && userID != ""
}

func AuthInterceptor(verifier AuthTokenVerifier, publicProcedures []string) connect.UnaryInterceptorFunc {
	public := procedureSet(publicProcedures)
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			if _, ok := public[req.Spec().Procedure]; ok {
				return next(ctx, req)
			}

			token, ok := bearerToken(req.Header().Get(authorizationHeader))
			if !ok || verifier == nil {
				return nil, unauthenticatedError()
			}

			identity, err := verifier.VerifyAccessToken(ctx, token)
			if errors.Is(err, ErrAuthVerifierUnavailable) {
				return nil, connect.NewError(connect.CodeUnavailable, errors.New("auth verifier unavailable"))
			}
			if err != nil || identity.UserID == "" {
				return nil, unauthenticatedError()
			}

			return next(ContextWithUserID(ctx, identity.UserID), req)
		}
	}
}

func procedureSet(procedures []string) map[string]struct{} {
	set := make(map[string]struct{}, len(procedures))
	for _, procedure := range procedures {
		if procedure != "" {
			set[procedure] = struct{}{}
		}
	}
	return set
}

func bearerToken(value string) (string, bool) {
	fields := strings.Fields(value)
	if len(fields) != 2 || !strings.EqualFold(fields[0], "Bearer") || fields[1] == "" {
		return "", false
	}
	return fields[1], true
}

func unauthenticatedError() error {
	return connect.NewError(connect.CodeUnauthenticated, errors.New("unauthenticated"))
}
