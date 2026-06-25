package rpcserver

import (
	"context"
	"log/slog"
	"time"

	"connectrpc.com/connect"
)

// rpcLogState is a mutable carrier the (outer) logging interceptor seeds into the
// context so inner interceptors can hand values back out. Context values set by
// an inner interceptor don't propagate outward, so auth fills this pointer to let
// logging record the resolved user id even though logging wraps auth.
type rpcLogState struct {
	userID string
}

type rpcLogStateKey struct{}

// NewLoggingInterceptor logs each unary RPC's procedure, user id, duration, and
// result code via slog. Mount it OUTERMOST (connect.WithInterceptors(logging,
// auth)) so even auth-rejected requests — which never reach the handler — are
// logged with their Connect code.
func NewLoggingInterceptor(logger *slog.Logger) connect.UnaryInterceptorFunc {
	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			state := &rpcLogState{}
			ctx = context.WithValue(ctx, rpcLogStateKey{}, state)

			start := time.Now()
			res, err := next(ctx, req)

			// connect.CodeOf(nil) is CodeUnknown, not OK — special-case success.
			code := "ok"
			if err != nil {
				code = connect.CodeOf(err).String()
			}
			logger.LogAttrs(ctx, slog.LevelInfo, "rpc",
				slog.String("procedure", req.Spec().Procedure),
				slog.String("user_id", state.userID),
				slog.Duration("took", time.Since(start)),
				slog.String("code", code),
			)
			return res, err
		}
	})
}
