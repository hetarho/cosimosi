package platform

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/observability"
)

type requestIDContextKey struct{}

const maxRequestIDLength = 128

func RequestIDFromContext(ctx context.Context) string {
	if requestID, ok := ctx.Value(requestIDContextKey{}).(string); ok {
		return requestID
	}
	return ""
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID, ok := normalizeRequestID(r.Header.Get(requestIDHeader))
		if !ok {
			requestID = newRequestID()
			r.Header.Set(requestIDHeader, requestID)
		}
		w.Header().Set(requestIDHeader, requestID)
		next.ServeHTTP(w, r)
	})
}

func RequestIDInterceptor() connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			requestID, ok := normalizeRequestID(req.Header().Get(requestIDHeader))
			if !ok {
				requestID = newRequestID()
			}
			ctx = context.WithValue(ctx, requestIDContextKey{}, requestID)

			resp, err := next(ctx, req)
			if resp != nil {
				resp.Header().Set(requestIDHeader, requestID)
			}
			return resp, err
		}
	}
}

func LoggingInterceptor(logger *log.Logger) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			start := time.Now()
			resp, err := next(ctx, req)
			if logger != nil {
				status := "ok"
				if err != nil {
					status = connect.CodeOf(err).String()
				}
				logger.Printf(
					"rpc method=%s request_id=%s status=%s duration=%s",
					req.Spec().Procedure,
					RequestIDFromContext(ctx),
					status,
					time.Since(start).Round(time.Microsecond),
				)
			}
			return resp, err
		}
	}
}

func StructuredErrorInterceptor(reporter observability.Reporter) connect.UnaryInterceptorFunc {
	if reporter == nil {
		reporter = observability.NoopReporter{}
	}
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			resp, err := next(ctx, req)
			if err == nil {
				return resp, nil
			}
			code := connect.CodeOf(err)
			if code != connect.CodeInternal && code != connect.CodeUnknown {
				return resp, err
			}
			errorType := safeErrorType(err)
			reporter.CaptureException(ctx, stableReportError("unexpected rpc error", errorType), observability.MustAttributes(map[string]string{
				"source":     "rpc",
				"method":     req.Spec().Procedure,
				"request_id": RequestIDFromContext(ctx),
				"rpc_code":   code.String(),
				"error_type": errorType,
			}))
			return resp, connect.NewError(connect.CodeInternal, errors.New("internal server error"))
		}
	}
}

func PanicRecoveryInterceptor(logger *log.Logger, reporter observability.Reporter) connect.UnaryInterceptorFunc {
	if reporter == nil {
		reporter = observability.NoopReporter{}
	}
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (resp connect.AnyResponse, err error) {
			defer func() {
				if recovered := recover(); recovered != nil {
					panicType := safePanicType(recovered)
					if logger != nil {
						logger.Printf("rpc panic method=%s request_id=%s", req.Spec().Procedure, requestIDFromContextOrRequest(ctx, req))
					}
					reporter.CaptureException(ctx, stableReportError("rpc panic recovered", panicType), observability.MustAttributes(map[string]string{
						"source":     "rpc_panic",
						"method":     req.Spec().Procedure,
						"request_id": requestIDFromContextOrRequest(ctx, req),
						"rpc_code":   connect.CodeInternal.String(),
						"panic_type": panicType,
					}))
					err = connect.NewError(connect.CodeInternal, errors.New("internal server error"))
				}
			}()
			return next(ctx, req)
		}
	}
}

func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return hex.EncodeToString([]byte(time.Now().UTC().Format(time.RFC3339Nano)))
	}
	return hex.EncodeToString(b[:])
}

func requestIDFromContextOrRequest(ctx context.Context, req connect.AnyRequest) string {
	if requestID := RequestIDFromContext(ctx); requestID != "" {
		return requestID
	}
	requestID, _ := normalizeRequestID(req.Header().Get(requestIDHeader))
	return requestID
}

func normalizeRequestID(value string) (string, bool) {
	if value == "" || len(value) > maxRequestIDLength {
		return "", false
	}
	for _, r := range value {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			continue
		}
		switch r {
		case '.', '_', '-', ':':
			continue
		default:
			return "", false
		}
	}
	return value, true
}

func safeErrorType(err error) string {
	if err == nil {
		return ""
	}
	if unwrapped := errors.Unwrap(err); unwrapped != nil {
		return fmt.Sprintf("%T", unwrapped)
	}
	return fmt.Sprintf("%T", err)
}

func safePanicType(recovered any) string {
	if recovered == nil {
		return ""
	}
	return fmt.Sprintf("%T", recovered)
}

func stableReportError(message string, discriminator string) error {
	if discriminator == "" {
		return errors.New(message)
	}
	return fmt.Errorf("%s: %s", message, discriminator)
}
