package platform

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/platform/values"
)

type AccountStatusReader interface {
	WithdrawnAt(ctx context.Context, userID string) (withdrawnAt time.Time, withdrawn bool, err error)
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
			withdrawnAt, withdrawn, err := reader.WithdrawnAt(ctx, userID)
			if err != nil {
				return nil, apperr.Internal(err)
			}
			if !withdrawn {
				return next(ctx, req)
			}
			withdrawnAt = withdrawnAt.UTC()
			deadline := withdrawnAt.Add(values.AccountWithdrawalRetentionWindow())
			return nil, apperr.Domain(
				connect.CodePermissionDenied,
				apperr.ReasonPlatformAccountWithdrawn,
				errors.New("account withdrawn"),
				map[string]string{
					"withdrawn_at":        withdrawnAt.Format(time.RFC3339),
					"restore_deadline_at": deadline.Format(time.RFC3339),
				},
			)
		}
	}
}
