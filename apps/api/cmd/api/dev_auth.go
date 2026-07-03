package main

import (
	"context"
	"os"
	"strings"

	"github.com/cosimosi/api/internal/platform"
)

const (
	envDevAuth         = "COSIMOSI_DEV_AUTH"
	devFakeTokenPrefix = "fake-token-"
)

// devAuthVerifier trusts the web dev sign-in bypass's `fake-token-<id>` bearers, mapping
// each to user id `<id>`, so `pnpm dev` can skip the Supabase login loop. It is gated
// behind COSIMOSI_DEV_AUTH — the same never-in-production env-flag pattern as
// COSIMOSI_DEV_WORKER — and the token shape is the FakeAuthAdapter's (`fake-token-<userId>`).
func devAuthVerifier() (platform.AuthTokenVerifier, bool) {
	if !truthy(os.Getenv(envDevAuth)) {
		return nil, false
	}
	verify := func(_ context.Context, token string) (platform.UserIdentity, error) {
		userID, ok := strings.CutPrefix(token, devFakeTokenPrefix)
		if !ok || userID == "" {
			return platform.UserIdentity{}, platform.ErrAuthTokenInvalid
		}
		return platform.UserIdentity{UserID: userID}, nil
	}
	return platform.AuthTokenVerifierFunc(verify), true
}
