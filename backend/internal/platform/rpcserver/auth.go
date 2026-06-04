package rpcserver

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"github.com/golang-jwt/jwt/v5"
)

type userIDKey struct{}

// UserIDFromContext returns the authenticated user id — the Supabase JWT "sub"
// claim injected by the auth interceptor. Feature handlers (04/11/12) use it to
// scope every query to the caller (constitution: user_id isolation). The bool is
// false on paths that never passed through the interceptor.
func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey{}).(string)
	return v, ok
}

// NewAuthInterceptor validates the Bearer JWT on each unary RPC against the
// Supabase shared HS256 secret, injects the "sub" claim as the user id, and
// rejects a missing/invalid/expired token with CodeUnauthenticated before the
// handler runs. /health is registered directly on the mux and bypasses this.
//
// Fails CLOSED when the secret is empty: golang-jwt's HMAC verify has no minimum
// key-length check, so a token forged with the empty key would otherwise verify
// (auth bypass + arbitrary user_id). We reject every protected RPC instead — the
// server still boots so /health and DB work locally without Supabase configured.
//
// MVP scope: signature + alg allowlist + expiry. aud/iss/role enforcement is
// deferred (Supabase aud can be a string or array and has varied across
// versions — enforcing it now risks false rejections). Asymmetric signing-key
// (JWKS) verification is a v1 swap behind this same interceptor.
func NewAuthInterceptor(secret string) connect.UnaryInterceptorFunc {
	key := []byte(secret)
	if len(key) == 0 {
		slog.Warn("SUPABASE_JWT_SECRET is empty — all protected RPCs will be rejected (auth fails closed)")
	}
	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			// This interceptor is for the server side; on a client it would attach
			// (not verify) a token, so pass through.
			if req.Spec().IsClient {
				return next(ctx, req)
			}

			if len(key) == 0 {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("auth not configured"))
			}

			raw, ok := strings.CutPrefix(req.Header().Get("Authorization"), "Bearer ")
			if !ok || raw == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing or malformed bearer token"))
			}

			tok, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) {
				// Defense-in-depth alongside WithValidMethods: reject non-HMAC algs
				// (blocks the RS256→HS256 key-confusion and "none" attacks).
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("unexpected signing method")
				}
				return key, nil
			}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
			if err != nil {
				// Log the precise reason server-side; return an opaque message so the
				// client can't distinguish expired vs bad-signature vs malformed.
				slog.Info("auth rejected", "reason", err.Error())
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("invalid token"))
			}

			sub, err := tok.Claims.GetSubject()
			if err != nil || sub == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token missing sub claim"))
			}

			// Hand the id back to the outer logging interceptor (see rpcLogState),
			// then inject it for downstream handlers.
			if state, ok := ctx.Value(rpcLogStateKey{}).(*rpcLogState); ok {
				state.userID = sub
			}
			ctx = context.WithValue(ctx, userIDKey{}, sub)
			return next(ctx, req)
		}
	})
}
