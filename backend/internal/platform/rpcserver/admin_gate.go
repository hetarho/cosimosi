package rpcserver

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"
)

// NewAdminGateInterceptor authorizes AdminService calls against the
// ADMIN_USER_IDS allowlist (spec 34): entries are Supabase user UUIDs and/or
// account emails, matched case-insensitively against the verified JWT
// sub/email claims (both injected by the auth interceptor, which runs before
// this in the chain).
//
// Fail-closed: an empty allowlist rejects EVERY caller — the admin surface is
// opt-in per environment. Unauthenticated requests never reach this gate (auth
// already rejected them), so a denial here is always PermissionDenied, which
// the client renders as a NotFound screen (the surface stays unadvertised).
func NewAdminGateInterceptor(allowlist []string) connect.UnaryInterceptorFunc {
	allowed := make(map[string]bool, len(allowlist))
	for _, entry := range allowlist {
		if e := strings.ToLower(strings.TrimSpace(entry)); e != "" {
			allowed[e] = true
		}
	}

	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			if req.Spec().IsClient {
				return next(ctx, req)
			}
			userID, _ := UserIDFromContext(ctx)
			email, _ := UserEmailFromContext(ctx)
			if len(allowed) > 0 &&
				((userID != "" && allowed[strings.ToLower(userID)]) ||
					(email != "" && allowed[strings.ToLower(email)])) {
				return next(ctx, req)
			}
			// One opaque message for every rejection (unknown caller, empty
			// allowlist): admin existence is not advertised to non-admins.
			return nil, connect.NewError(connect.CodePermissionDenied, errors.New("permission denied"))
		}
	})
}
