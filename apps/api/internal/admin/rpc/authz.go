// Package rpc is the admin context's transport adapter: the admin-authorization interceptor plus a
// thin Connect handler mapping proto↔domain (ARCHITECTURE §2.7/§2.9#7). All policy lives in the
// admin use-case; this layer only maps and gates.
package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	adminv1connect "github.com/cosimosi/api/internal/gen/cosimosi/admin/v1/adminv1connect"
	"github.com/cosimosi/api/internal/platform"
)

// Authorizer is the admin-membership check the interceptor consults (satisfied by admin.Service).
type Authorizer interface {
	IsAdmin(ctx context.Context, userID string) (bool, error)
}

// GetAdminSelf is the one admin.v1 method NOT admin-gated: it is the membership probe the FE gate
// calls to learn whether the caller is an admin, so it must return {isAdmin:false} to a non-admin
// rather than PermissionDenied. It still requires authentication (the platform auth interceptor).
var probeProcedure = adminv1connect.AdminServiceGetAdminSelfProcedure

// AuthorizationInterceptor gates every admin.v1 method except the GetAdminSelf probe: it runs AFTER
// the platform auth interceptor (so a canonical user id is already in context) and returns
// PermissionDenied for a non-admin caller — distinct from the auth interceptor's Unauthenticated
// for an anonymous one. Attach it to the admin service handler only, so it never touches others.
func AuthorizationInterceptor(authorizer Authorizer) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			userID, ok := platform.UserIDFromContext(ctx)
			if !ok || userID == "" {
				return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("unauthenticated"))
			}
			if req.Spec().Procedure == probeProcedure {
				return next(ctx, req) // the "am I admin?" probe is open to any authenticated user
			}
			isAdmin, err := authorizer.IsAdmin(ctx, userID)
			if err != nil {
				return nil, connect.NewError(connect.CodeInternal, err)
			}
			if !isAdmin {
				return nil, connect.NewError(connect.CodePermissionDenied, errors.New("admin access required"))
			}
			return next(ctx, req)
		}
	}
}
