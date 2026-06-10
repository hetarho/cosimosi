package rpcserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"

	"connectrpc.com/connect"
)

// PanicCapture forwards a recovered RPC panic to an error tracker. The
// composition root (cmd/api) injects the Sentry-backed implementation; nil =
// log-only. An injected hook keeps rpcserver infra-only — it never imports
// Sentry itself (same reason the sentryhttp wrap lives in main.go).
type PanicCapture func(ctx context.Context, procedure string, p any)

// newRecoverHandler builds the connect.WithRecover callback (17, acceptance
// 2.7): the panic VALUE and STACK are logged (a bare value like "nil pointer
// dereference" is undiagnosable without frames), optionally forwarded to the
// capture hook, and the client gets a clean CodeInternal — the recovered value
// is never leaked into the response.
func newRecoverHandler(logger *slog.Logger, capture PanicCapture) func(context.Context, connect.Spec, http.Header, any) error {
	return func(ctx context.Context, spec connect.Spec, _ http.Header, p any) error {
		logger.Error("rpc panic recovered",
			"procedure", spec.Procedure,
			"panic", p,
			"stack", string(debug.Stack()),
		)
		if capture != nil {
			capture(ctx, spec.Procedure, p)
		}
		return connect.NewError(connect.CodeInternal, errors.New("internal error"))
	}
}
