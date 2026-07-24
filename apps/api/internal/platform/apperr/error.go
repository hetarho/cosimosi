// Package apperr owns the service-wide Connect error detail contract.
package apperr

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"connectrpc.com/connect"
	platformv1 "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1"
	"google.golang.org/protobuf/proto"
)

const (
	EnvErrorDetail = "COSIMOSI_ERROR_DETAIL"
	DetailVerbose  = "verbose"

	ReasonInternal                        = "INTERNAL"
	ReasonUnknown                         = "UNKNOWN"
	ReasonPlatformUnauthenticated         = "PLATFORM_UNAUTHENTICATED"
	ReasonPlatformAuthVerifierUnavailable = "PLATFORM_AUTH_VERIFIER_UNAVAILABLE"
)

// Domain constructs an expected error. Its message is safe to send to a client.
func Domain(code connect.Code, reason string, err error, metadata map[string]string) error {
	if err == nil {
		err = errors.New(code.String())
	}
	info := &platformv1.ErrorInfo{
		Reason:   reason,
		Domain:   domainFromReason(reason),
		Metadata: cloneMetadata(metadata),
	}
	return withDetail(connect.NewError(code, err), info)
}

// Internal preserves the raw cause until the outer structured-error interceptor logs and masks it.
func Internal(err error) error {
	if err == nil {
		err = errors.New("internal error")
	}
	return withDetail(connect.NewError(connect.CodeInternal, err), &platformv1.ErrorInfo{
		Reason: ReasonInternal,
		Domain: "platform",
	})
}

// MaskedInternal builds the only client-visible representation of an unexpected failure.
func MaskedInternal(requestID string, debugDetail string) error {
	return withDetail(
		connect.NewError(connect.CodeInternal, errors.New("internal server error")),
		&platformv1.ErrorInfo{
			Reason:      ReasonInternal,
			Domain:      "platform",
			RequestId:   requestID,
			DebugDetail: debugDetail,
		},
	)
}

// WithRequestID injects the server-authoritative correlation id while preserving other details and metadata.
func WithRequestID(err error, requestID string) error {
	if err == nil {
		return nil
	}
	code := connect.CodeOf(err)
	connectErr := asConnectError(err, code)
	rebuilt := connect.NewError(code, errors.New(connectErr.Message()))
	copyHTTPHeader(rebuilt.Meta(), connectErr.Meta())

	found := false
	for _, detail := range connectErr.Details() {
		value, valueErr := detail.Value()
		info, ok := value.(*platformv1.ErrorInfo)
		if valueErr != nil || !ok {
			rebuilt.AddDetail(detail)
			continue
		}
		if found {
			continue
		}
		found = true
		enriched := proto.Clone(info).(*platformv1.ErrorInfo)
		enriched.RequestId = requestID
		addDetail(rebuilt, enriched)
	}
	if !found {
		addDetail(rebuilt, &platformv1.ErrorInfo{
			Reason:    DefaultReason(code),
			Domain:    "platform",
			RequestId: requestID,
		})
	}
	return rebuilt
}

// Info returns the first ErrorInfo detail, if present.
func Info(err error) (*platformv1.ErrorInfo, bool) {
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		return nil, false
	}
	for _, detail := range connectErr.Details() {
		value, valueErr := detail.Value()
		if valueErr != nil {
			continue
		}
		if info, ok := value.(*platformv1.ErrorInfo); ok {
			return info, true
		}
	}
	return nil, false
}

// DefaultReason keeps foreign/generated non-domain failures machine-readable.
func DefaultReason(code connect.Code) string {
	if code == connect.CodeInternal || code == connect.CodeUnknown {
		return ReasonInternal
	}
	return "PLATFORM_" + strings.ToUpper(code.String())
}

// ExposeDetail is deliberately opt-in: every value except "verbose" masks raw internal detail.
func ExposeDetail() bool {
	return os.Getenv(EnvErrorDetail) == DetailVerbose
}

func asConnectError(err error, code connect.Code) *connect.Error {
	var connectErr *connect.Error
	if errors.As(err, &connectErr) {
		return connectErr
	}
	return connect.NewError(code, err)
}

func withDetail(connectErr *connect.Error, info *platformv1.ErrorInfo) error {
	addDetail(connectErr, info)
	return connectErr
}

func addDetail(connectErr *connect.Error, info *platformv1.ErrorInfo) {
	detail, err := connect.NewErrorDetail(info)
	if err != nil {
		panic(err)
	}
	connectErr.AddDetail(detail)
}

func domainFromReason(reason string) string {
	if reason == ReasonInternal || reason == ReasonUnknown {
		return "platform"
	}
	prefix, _, ok := strings.Cut(reason, "_")
	if !ok || prefix == "" {
		return "platform"
	}
	for _, char := range prefix {
		if char < 'A' || char > 'Z' {
			return "platform"
		}
	}
	return strings.ToLower(prefix)
}

func cloneMetadata(metadata map[string]string) map[string]string {
	if len(metadata) == 0 {
		return nil
	}
	clone := make(map[string]string, len(metadata))
	for key, value := range metadata {
		clone[key] = value
	}
	return clone
}

func copyHTTPHeader(target http.Header, source http.Header) {
	for key, values := range source {
		target[key] = append([]string(nil), values...)
	}
}
