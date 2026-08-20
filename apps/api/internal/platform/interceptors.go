package platform

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform/apperr"
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
			requestID = NewID()
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
				requestID = NewID()
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
				if err != nil {
					// This interceptor runs inside StructuredErrorInterceptor, so it
					// sees the raw error before internal/unknown ones are masked to a
					// generic message. Log the underlying cause here — otherwise a
					// prod 500 leaves only the code in the container logs and is
					// undiagnosable without Sentry.
					logger.Printf(
						"rpc method=%s request_id=%s status=%s duration=%s error=%q",
						req.Spec().Procedure,
						RequestIDFromContext(ctx),
						connect.CodeOf(err).String(),
						time.Since(start).Round(time.Microsecond),
						err.Error(),
					)
				} else {
					logger.Printf(
						"rpc method=%s request_id=%s status=%s duration=%s",
						req.Spec().Procedure,
						RequestIDFromContext(ctx),
						"ok",
						time.Since(start).Round(time.Microsecond),
					)
				}
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
			requestID := requestIDFromContextOrRequest(ctx, req)
			code := connect.CodeOf(err)
			if code != connect.CodeInternal && code != connect.CodeUnknown {
				if apperr.IsReported(err) {
					reportDomainFailure(ctx, reporter, req, requestID, code, err)
				}
				return resp, apperr.WithRequestID(err, requestID)
			}
			errorType := safeErrorType(err)
			reporter.CaptureException(ctx, stableReportError("unexpected rpc error", errorType), observability.MustAttributes(map[string]string{
				"source":     "rpc",
				"method":     req.Spec().Procedure,
				"request_id": requestID,
				"rpc_code":   code.String(),
				"reason":     apperr.ReasonInternal,
				"error_type": errorType,
			}))
			debugDetail := ""
			if apperr.ExposeDetail() {
				debugDetail = err.Error()
			}
			return resp, apperr.MaskedInternal(requestID, debugDetail)
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
					requestID := requestIDFromContextOrRequest(ctx, req)
					if logger != nil {
						logger.Printf("rpc panic method=%s request_id=%s", req.Spec().Procedure, requestID)
					}
					reporter.CaptureException(ctx, stableReportError("rpc panic recovered", panicType), observability.MustAttributes(map[string]string{
						"source":     "rpc_panic",
						"method":     req.Spec().Procedure,
						"request_id": requestID,
						"rpc_code":   connect.CodeInternal.String(),
						"reason":     apperr.ReasonInternal,
						"panic_type": panicType,
					}))
					debugDetail := ""
					if apperr.ExposeDetail() {
						debugDetail = fmt.Sprint(recovered)
					}
					err = apperr.MaskedInternal(requestID, debugDetail)
				}
			}()
			return next(ctx, req)
		}
	}
}

func requestIDFromContextOrRequest(ctx context.Context, req connect.AnyRequest) string {
	if requestID := RequestIDFromContext(ctx); requestID != "" {
		return requestID
	}
	requestID, _ := normalizeRequestID(req.Header().Get(requestIDHeader))
	if requestID != "" {
		return requestID
	}
	return NewID()
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

// reportDomainFailure sends an apperr.Reported refusal to the exception feed without masking it.
// The event carries the reason and the refusal's own metadata — which the error contract already
// limits to non-content discriminators — and never the error message, because a domain instruction
// can quote the writer's passage. Grouping is by reason, so one recurring invariant failure reads as
// one issue. Telemetry must not be able to fail a request: a metadata key the attribute guard
// refuses degrades to the base attributes instead of panicking.
func reportDomainFailure(
	ctx context.Context,
	reporter observability.Reporter,
	req connect.AnyRequest,
	requestID string,
	code connect.Code,
	err error,
) {
	// A reporter that panics must not turn a refusal that was deliberately NOT masked into a masked
	// internal one: telemetry is an observer here, never part of the response.
	defer func() { _ = recover() }()

	reason := apperr.DefaultReason(code)
	base := map[string]string{
		"source":     "rpc",
		"method":     req.Spec().Procedure,
		"request_id": requestID,
		"rpc_code":   code.String(),
	}
	metadata := map[string]string{}
	if info, ok := apperr.Info(err); ok {
		reason = info.GetReason()
		metadata = info.GetMetadata()
	}
	base["reason"] = reason

	attrs := observability.MustAttributes(base)
	// The guard is applied to the metadata's OWN keys, before they are prefixed: checking
	// "detail_diary" would normalize away from "diary" and wave the blocked key through.
	if len(metadata) > 0 {
		if _, err := observability.NewAttributes(metadata); err == nil {
			values := make(map[string]string, len(base)+len(metadata))
			for key, value := range base {
				values[key] = value
			}
			for key, value := range metadata {
				values["detail_"+key] = value
			}
			if enriched, err := observability.NewAttributes(values); err == nil {
				attrs = enriched
			}
		}
	}
	reporter.CaptureException(ctx, stableReportError("reported domain failure", reason), attrs)
}

func stableReportError(message string, discriminator string) error {
	if discriminator == "" {
		return errors.New(message)
	}
	return fmt.Errorf("%s: %s", message, discriminator)
}
