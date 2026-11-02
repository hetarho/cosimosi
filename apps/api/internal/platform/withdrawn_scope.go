package platform

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/apperr"
)

// AccountStatus is the admission gate's view of one account. The account context owns the
// withdrawal and its restore deadline; the gate only relays them to a refused caller.
type AccountStatus struct {
	Withdrawn         bool
	WithdrawnAt       time.Time
	RestoreDeadlineAt time.Time
}

type AccountStatusReader interface {
	AccountStatus(ctx context.Context, userID string) (AccountStatus, error)
}

func WithdrawnScopeInterceptor(
	reader AccountStatusReader,
	exemptProcedures []string,
) connect.UnaryInterceptorFunc {
	exempt := procedureSet(exemptProcedures)
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			if _, ok := exempt[req.Spec().Procedure]; ok {
				return next(ctx, req)
			}
			userID, authenticated := UserIDFromContext(ctx)
			if !authenticated {
				return next(ctx, req)
			}
			if reader == nil {
				return nil, apperr.Internal(errors.New("account status reader unavailable"))
			}
			status, err := reader.AccountStatus(ctx, userID)
			if err != nil {
				return nil, apperr.Internal(err)
			}
			if !status.Withdrawn {
				return next(ctx, req)
			}
			return nil, apperr.Domain(
				connect.CodePermissionDenied,
				apperr.ReasonPlatformAccountWithdrawn,
				errors.New("account withdrawn"),
				map[string]string{
					"withdrawn_at":        status.WithdrawnAt.UTC().Format(time.RFC3339),
					"restore_deadline_at": status.RestoreDeadlineAt.UTC().Format(time.RFC3339),
				},
			)
		}
	}
}
