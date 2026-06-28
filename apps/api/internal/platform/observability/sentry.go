package observability

import (
	"context"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

const (
	sentryDSNEnv     = "COSIMOSI_SENTRY_DSN"
	sentryReleaseEnv = "COSIMOSI_RELEASE"
)

type SentryReporter struct{}

func NewReporterFromEnv() (Reporter, error) {
	dsn := os.Getenv(sentryDSNEnv)
	if dsn == "" {
		return NoopReporter{}, nil
	}
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:            dsn,
		Release:        os.Getenv(sentryReleaseEnv),
		SendDefaultPII: false,
	}); err != nil {
		return nil, err
	}
	return SentryReporter{}, nil
}

func (SentryReporter) CaptureException(ctx context.Context, err error, attrs Attributes) {
	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}
	hub.WithScope(func(scope *sentry.Scope) {
		for key, value := range attrs.Values() {
			scope.SetTag(key, value)
		}
		hub.CaptureException(err)
	})
}

func (SentryReporter) CaptureMessage(ctx context.Context, message string, level Level, attrs Attributes) {
	hub := sentry.GetHubFromContext(ctx)
	if hub == nil {
		hub = sentry.CurrentHub()
	}
	hub.WithScope(func(scope *sentry.Scope) {
		for key, value := range attrs.Values() {
			scope.SetTag(key, value)
		}
		hub.CaptureMessage(message)
	})
}

func (SentryReporter) Flush(timeout time.Duration) bool {
	return sentry.Flush(timeout)
}
