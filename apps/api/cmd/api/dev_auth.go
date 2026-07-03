package main

import (
	"context"
	"os"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

const (
	envDevAuth         = "COSIMOSI_DEV_AUTH"
	envDevUserID       = "COSIMOSI_DEV_USER_ID"
	devFakeTokenPrefix = "fake-token-"
)

// devAuthVerifier trusts the web dev sign-in bypass's `fake-token-<id>` bearer for exactly
// ONE pinned user, so `pnpm dev` can skip the Supabase login loop without widening user
// scope. It is gated behind COSIMOSI_DEV_AUTH (the same never-in-production env-flag pattern
// as COSIMOSI_DEV_WORKER) AND requires COSIMOSI_DEV_USER_ID to name the allowed user — the
// verifier accepts only `fake-token-<COSIMOSI_DEV_USER_ID>`, matching the web's
// VITE_DEV_USER_ID. With the flag on but no pinned user it stays off (returns false) rather
// than trusting an arbitrary token suffix.
func devAuthVerifier() (platform.AuthTokenVerifier, bool) {
	if !truthy(os.Getenv(envDevAuth)) {
		return nil, false
	}
	allowedUserID := strings.TrimSpace(os.Getenv(envDevUserID))
	if allowedUserID == "" {
		return nil, false
	}
	verify := func(_ context.Context, token string) (platform.UserIdentity, error) {
		userID, ok := strings.CutPrefix(token, devFakeTokenPrefix)
		if !ok || userID != allowedUserID {
			return platform.UserIdentity{}, platform.ErrAuthTokenInvalid
		}
		return platform.UserIdentity{UserID: userID}, nil
	}
	return platform.AuthTokenVerifierFunc(verify), true
}
