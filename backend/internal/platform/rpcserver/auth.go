package rpcserver

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"
	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

type userIDKey struct{}

// UserIDFromContext returns the authenticated user id — the Supabase JWT "sub"
// claim injected by the auth interceptor. Feature handlers use it to scope every
// query to the caller (user_id isolation). The bool is false on paths that never
// passed through the interceptor.
func UserIDFromContext(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey{}).(string)
	return v, ok
}

// NewAuthInterceptor validates the Bearer JWT on each unary RPC, injects the "sub"
// claim as the user id, and rejects a missing/invalid/expired token with
// CodeUnauthenticated before the handler runs. /health is registered directly on the
// mux and bypasses this.
//
// Two verification paths, selected by the token's alg (and constrained by
// WithValidMethods, so an attacker can't downgrade across them):
//   - ES256/RS256 (Supabase's default, asymmetric signing keys) → verified against the
//     project's PUBLIC keys from {projectURL}/auth/v1/.well-known/jwks.json (fetched once
//     at boot, cached + auto-refreshed, selected by `kid`).
//   - HS256 (legacy shared secret) → verified with `secret`.
//
// Fails CLOSED: with neither a JWKS source nor a secret, every protected RPC is rejected.
// HMAC is only allowed when `secret` is non-empty (golang-jwt's HMAC verify has no minimum
// key-length check, so an empty key would otherwise verify — auth bypass). The server
// still boots without Supabase configured so /health and local DB work.
//
// Validates signature + alg allowlist + expiry only. aud/iss/role are not enforced
// (Supabase aud can be a string or array and has varied across versions).
func NewAuthInterceptor(secret, projectURL string) connect.UnaryInterceptorFunc {
	key := []byte(secret)
	methods := make([]string, 0, 3)
	if len(key) > 0 {
		methods = append(methods, "HS256")
	}

	// Asymmetric verification via the Supabase project JWKS (the default since 2025).
	var jwks jwt.Keyfunc
	if projectURL != "" {
		jwksURL := strings.TrimRight(projectURL, "/") + "/auth/v1/.well-known/jwks.json"
		k, err := keyfunc.NewDefault([]string{jwksURL})
		if err != nil {
			// Don't fail boot — log and run HMAC-only (asymmetric tokens then rejected).
			slog.Warn("JWKS init failed; asymmetric tokens will be rejected", "url", jwksURL, "err", err)
		} else {
			jwks = k.Keyfunc
			methods = append(methods, "ES256", "RS256")
			slog.Info("JWKS verification enabled", "url", jwksURL)
		}
	}

	if len(methods) == 0 {
		slog.Warn("no JWT verification configured (set SUPABASE_PROJECT_URL for JWKS and/or SUPABASE_JWT_SECRET) — all protected RPCs will be rejected (auth fails closed)")
	}

	// keyFor returns the correct key material per alg family, never crossing them
	// (blocks the RS256→HS256 key-confusion and "none" attacks).
	keyFor := func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); ok {
			if len(key) == 0 {
				return nil, errors.New("HMAC token but no secret configured")
			}
			return key, nil
		}
		if jwks == nil {
			return nil, errors.New("asymmetric token but JWKS not configured")
		}
		return jwks(t) // ES256/RS256 → JWKS public key by kid
	}

	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			// This interceptor is for the server side; on a client it would attach
			// (not verify) a token, so pass through.
			if req.Spec().IsClient {
				return next(ctx, req)
			}

			if len(methods) == 0 {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("auth not configured"))
			}

			raw, ok := strings.CutPrefix(req.Header().Get("Authorization"), "Bearer ")
			if !ok || raw == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing or malformed bearer token"))
			}

			tok, err := jwt.Parse(raw, keyFor, jwt.WithValidMethods(methods), jwt.WithExpirationRequired())
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
