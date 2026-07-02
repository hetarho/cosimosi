package ai

import (
	"errors"
	"fmt"
	"time"
)

// The typed error set is the only vocabulary of provider failure allowed to cross
// out of internal/ai. Each provider client normalizes every vendor SDK / HTTP
// failure into one of these so plan 22's job backoff and the RPC error mapping stay
// provider-independent — no vendor error type ever reaches a consumer.
//
// The set is: rate-limited (retryable) · auth-failed (terminal) · cost-capped ·
// malformed-structured-output. cost-capped is [CostLimitError] (metering.go); it
// lives beside the meter that raises it.

// RateLimitedError is a retryable transient failure — provider throttling, overload,
// or a transport error. It feeds the plan-22 jobs backoff via the generic retry path.
type RateLimitedError struct {
	Provider   string
	RetryAfter time.Duration // provider hint, 0 if none
	Err        error
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("ai: %s rate limited: %v", e.Provider, e.Err)
}

func (e *RateLimitedError) Unwrap() error { return e.Err }

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
