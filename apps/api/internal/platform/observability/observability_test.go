package observability

import "testing"

func TestAttributesRejectSensitiveFields(t *testing.T) {
	t.Parallel()

	if _, err := NewAttributes(map[string]string{"request_id": "request-1"}); err != nil {
		t.Fatalf("safe attributes failed: %v", err)
	}
	if _, err := NewAttributes(map[string]string{"access_token": "secret"}); err == nil {
		t.Fatal("sensitive token attribute unexpectedly succeeded")
	}
	if _, err := NewAttributes(map[string]string{"api_key": "secret"}); err == nil {
		t.Fatal("sensitive API key attribute unexpectedly succeeded")
	}
	if _, err := NewAttributes(map[string]string{"raw_embedding": "1,2,3"}); err == nil {
		t.Fatal("sensitive embedding attribute unexpectedly succeeded")
	}
}
