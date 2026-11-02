package platform

import (
	"context"
	"errors"
	"fmt"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/apperr"
)

// serverWriteTimeout is the HTTP server's response deadline. Every request budget stays inside it,
// or the connection would be cut before the cooperative deadline could answer.
const serverWriteTimeout = 4 * time.Minute

// RequestBudgets bounds decoding and cooperative dependency execution. Connect also
// applies MaxMessageBytes after decompression; the HTTP wrapper bounds the wire body.
type RequestBudgets struct {
	MaxMessageBytes int
	DefaultTimeout  time.Duration
}

func DefaultRequestBudgets() RequestBudgets {
	return RequestBudgets{
		MaxMessageBytes: 8 << 20,
		DefaultTimeout:  30 * time.Second,
	}
}

// ProcedureTimeout is a deadline a context registers for one of its own procedures beyond the
// default (a provider call, a whole-universe export). The owning context names the procedure and
// the length; platform only enforces it.
type ProcedureTimeout struct {
	Procedure string
	Timeout   time.Duration
}

func WithRequestBudgets(b RequestBudgets) HandlerOption {
	if b.MaxMessageBytes <= 0 || b.DefaultTimeout <= 0 || b.DefaultTimeout >= serverWriteTimeout {
		panic("request budgets must be positive and inside the server write deadline")
	}
	return func(cfg *handlerConfig) { cfg.budgets = b }
}

// registerProcedureTimeouts refuses an unusable or conflicting deadline at composition, like the
// other budgets: a typo'd procedure silently falling back to the default is what this replaces.
func registerProcedureTimeouts(into map[string]time.Duration, timeouts []ProcedureTimeout) {
	for _, timeout := range timeouts {
		if timeout.Procedure == "" || timeout.Timeout <= 0 || timeout.Timeout >= serverWriteTimeout {
			panic(fmt.Sprintf("procedure timeout %q = %v must name a procedure and sit inside the server write deadline", timeout.Procedure, timeout.Timeout))
		}
		if _, taken := into[timeout.Procedure]; taken {
			panic(fmt.Sprintf("procedure timeout %q is registered twice", timeout.Procedure))
		}
		into[timeout.Procedure] = timeout.Timeout
	}
}

func RequestBudgetInterceptor(b RequestBudgets, procedureTimeouts map[string]time.Duration) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			timeout, ok := procedureTimeouts[req.Spec().Procedure]
			if !ok {
				timeout = b.DefaultTimeout
			}
			ctx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()
			response, err := next(ctx, req)
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, apperr.Domain(connect.CodeDeadlineExceeded, apperr.DefaultReason(connect.CodeDeadlineExceeded), context.DeadlineExceeded, nil)
			}
			return response, err
		}
	}
}
