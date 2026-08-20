package ai

import (
	"errors"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/memory"
)

// The typed error set is the only vocabulary of provider failure allowed to cross
// out of internal/ai. Each provider client normalizes every vendor SDK / HTTP
// failure into one of these so the job backoff and the RPC error mapping stay
// provider-independent — no vendor error type ever reaches a consumer. Caller
// cancellation and deadlines remain standard context errors because they are
// control-flow signals, not provider failures.
//
// The set is: rate-limited (retryable) · auth-failed (terminal) · cost-capped ·
// malformed-structured-output. cost-capped is [CostLimitError] (metering.go); it
// lives beside the meter that raises it.

// RateLimitedError is a retryable transient failure — provider throttling, overload,
// or a transport error. It feeds the jobs backoff via the generic retry path.
type RateLimitedError struct {
	Provider   string
	RetryAfter time.Duration // provider hint, 0 if none
	Err        error
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("ai: %s rate limited: %v", e.Provider, e.Err)
}

func (e *RateLimitedError) Unwrap() error { return e.Err }

// RetryAt honors a provider's Retry-After hint so the worker waits at least as long as
// the provider asked before hitting it again, instead of its own shorter backoff. A
// zero (no hint) falls back to the generic exponential backoff.
func (e *RateLimitedError) RetryAt() time.Time {
	if e.RetryAfter <= 0 {
		return time.Time{}
	}
	return time.Now().UTC().Add(e.RetryAfter)
}

// AuthFailedError is a terminal failure the operator must resolve — a bad or missing
// key, a forbidden model, or any other request the provider will keep rejecting.
type AuthFailedError struct {
	Provider string
	Err      error
}

func (e *AuthFailedError) Error() string {
	return fmt.Sprintf("ai: %s authentication failed: %v", e.Provider, e.Err)
}

func (e *AuthFailedError) Unwrap() error { return e.Err }

// MalformedStructuredOutputError means the provider returned a response that does not
// satisfy the requested output shape. The decision to retry belongs to the port
// adapter that owns the prompt/schema, never to the client.
type MalformedStructuredOutputError struct {
	Provider string
	Err      error
}

func (e *MalformedStructuredOutputError) Error() string {
	return fmt.Sprintf("ai: %s returned malformed structured output: %v", e.Provider, e.Err)
}

func (e *MalformedStructuredOutputError) Unwrap() error { return e.Err }

// portError translates this package's typed failures into the vocabulary of the consumer whose port
// is being crossed. Only the cost cap needs it today: it is the one provider-side failure the
// product answers with a specific refusal, and `memory` cannot name `*CostLimitError` itself (this
// package implements memory's ports, so the dependency points inward and never back).
//
// It WRAPS both ways rather than replacing: the RPC layer matches memory's sentinel, while the
// worker's backoff still finds RetryAt() on the original through the chain.
func portError(err error) error {
	if err == nil {
		return nil
	}
	if IsCostLimitError(err) {
		return fmt.Errorf("%w: %w", memory.ErrAiCallCapReached, err)
	}
	return err
}

func IsRateLimited(err error) bool {
	var target *RateLimitedError
	return errors.As(err, &target)
}

func IsAuthFailed(err error) bool {
	var target *AuthFailedError
	return errors.As(err, &target)
}

func IsMalformedStructuredOutput(err error) bool {
	var target *MalformedStructuredOutputError
	return errors.As(err, &target)
}
