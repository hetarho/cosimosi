package main

import (
	"context"
	"testing"
)

func TestDevAuthVerifierGating(t *testing.T) {
	t.Run("off when the flag is unset", func(t *testing.T) {
		t.Setenv(envDevAuth, "")
		t.Setenv(envDevUserID, "dev-user")
		if _, ok := devAuthVerifier(); ok {
			t.Fatal("expected the dev verifier off when COSIMOSI_DEV_AUTH is empty")
		}
	})

	t.Run("off when no pinned user id", func(t *testing.T) {
		t.Setenv(envDevAuth, "1")
		t.Setenv(envDevUserID, "")
		if _, ok := devAuthVerifier(); ok {
			t.Fatal("expected the dev verifier off without COSIMOSI_DEV_USER_ID")
		}
	})
}

func TestDevAuthVerifierTrustsOnlyThePinnedUser(t *testing.T) {
	t.Setenv(envDevAuth, "1")
	t.Setenv(envDevUserID, "dev-user")

	verifier, ok := devAuthVerifier()
	if !ok {
		t.Fatal("expected the dev verifier on")
	}

	identity, err := verifier.VerifyAccessToken(context.Background(), "fake-token-dev-user")
	if err != nil {
		t.Fatalf("pinned user rejected: %v", err)
	}
	if identity.UserID != "dev-user" {
		t.Fatalf("user id = %q, want dev-user", identity.UserID)
	}

	// Any other suffix, a bare/empty token, or the raw id must be rejected — the dev bypass
	// never widens scope beyond the single pinned user.
	for _, token := range []string{"fake-token-other-user", "fake-token-", "dev-user", "bearer-xyz", ""} {
		if _, err := verifier.VerifyAccessToken(context.Background(), token); err == nil {
			t.Fatalf("expected rejection for token %q", token)
		}
	}
}
