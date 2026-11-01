package platform

import (
	"context"
	"errors"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/apperr"
)

// RequestBudgets bounds decoding and cooperative dependency execution. Connect also
// applies MaxMessageBytes after decompression; the HTTP wrapper bounds the wire body.
type RequestBudgets struct {
	MaxMessageBytes int
	DefaultTimeout  time.Duration
	AITimeout       time.Duration
	ExportTimeout   time.Duration
}

func DefaultRequestBudgets() RequestBudgets {
	return RequestBudgets{
		MaxMessageBytes: 8 << 20,
		DefaultTimeout:  30 * time.Second,
		AITimeout:       3 * time.Minute,
		ExportTimeout:   2 * time.Minute,
	}
}

func (b RequestBudgets) timeout(procedure string) time.Duration {
	if strings.HasSuffix(procedure, "/Export") {
		return b.ExportTimeout
	}
	for _, method := range []string{"/SplitDiary", "/ReviseSplit", "/Recall", "/RecallDiaryStars", "/SuggestLetGo", "/LaunchStars"} {
		if strings.HasSuffix(procedure, method) {
			return b.AITimeout
		}
	}
	return b.DefaultTimeout
}

func WithRequestBudgets(b RequestBudgets) HandlerOption {
	if b.MaxMessageBytes <= 0 || b.DefaultTimeout <= 0 || b.AITimeout <= 0 || b.ExportTimeout <= 0 {
		panic("request budgets must be positive")
	}
	return func(cfg *handlerConfig) { cfg.budgets = b }
}

func RequestBudgetInterceptor(b RequestBudgets) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			ctx, cancel := context.WithTimeout(ctx, b.timeout(req.Spec().Procedure))
			defer cancel()
			response, err := next(ctx, req)
			if errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return nil, apperr.Domain(connect.CodeDeadlineExceeded, apperr.DefaultReason(connect.CodeDeadlineExceeded), context.DeadlineExceeded, nil)
			}
			return response, err
		}
	}
}
