package rpcserver

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"
)

// MembershipChecker reports whether an authenticated user has redeemed an invite code (spec 41).
// The invite repository implements it; rpcserver depends only on this narrow port (no import of
// internal/invite — the PanicCapture / MembershipChecker precedent keeps rpcserver infra-only).
type MembershipChecker interface {
	IsMember(ctx context.Context, userID string) (bool, error)
}

// NewMembershipGateInterceptor blocks a not-yet-member caller from the core universe services
// (Memory/Settings/Share/Gift) with PermissionDenied, while letting them through once they have
// redeemed a code (spec 41). It runs AFTER auth (the chain is logging→auth→membership), so the
// user id is present; an unauthenticated request never reaches here (auth already rejected it).
//
// This interceptor is mounted ONLY when INVITE_GATE_ENABLED is true (server.go) — with the gate
// off the core services keep the plain auth chain and the gate is fully transparent. InviteService
// (the redeem surface) and the admin services never carry this interceptor, so a not-yet-member
// can always reach redeem, and the bootstrap admin can issue codes without being a member.
func NewMembershipGateInterceptor(checker MembershipChecker, adminAllowlist []string) connect.UnaryInterceptorFunc {
	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			if req.Spec().IsClient {
				return next(ctx, req)
			}
			userID, err := RequireUserID(ctx)
			if err != nil {
				// Defensive: auth runs first and would have rejected a token-less request.
				return nil, err
			}
			// Admins (ADMIN_USER_IDS) enter without redeeming a code (spec 41) — they bootstrap the
			// gate (issue the first invites) and shouldn't be locked out of their own universe.
			if IsAllowlistedAdmin(ctx, adminAllowlist) {
				return next(ctx, req)
			}
			member, err := checker.IsMember(ctx, userID)
			if err != nil {
				// Log the real cause server-side; return an opaque message (the auth.go/recover.go
				// pattern) so DB/infra details (host:port, "connection refused") don't reach clients.
				slog.Default().Warn("membership check failed", "err", err)
				return nil, connect.NewError(connect.CodeInternal, errors.New("internal error"))
			}
			if !member {
				return nil, connect.NewError(connect.CodePermissionDenied, errors.New("membership required"))
			}
			return next(ctx, req)
		}
	})
}
