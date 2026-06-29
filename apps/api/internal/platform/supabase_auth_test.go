package platform

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestSupabaseJWTVerifierVerifiesJWKSAndCaches(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	jwks := rsaJWKS(&privateKey.PublicKey, "kid-1")
	jwksHits := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/v1/.well-known/jwks.json":
			jwksHits += 1
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(jwks))
		case "/auth/v1/user":
			t.Fatal("verifier unexpectedly called Supabase user endpoint")
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, nil)

	for range 2 {
		identity, err := verifier.VerifyAccessToken(context.Background(), token)
		if err != nil {
			t.Fatalf("VerifyAccessToken failed: %v", err)
		}
		if got := identity.UserID; got != "supabase-user-1" {
			t.Fatalf("user id = %q, want supabase-user-1", got)
		}
	}
	if jwksHits != 1 {
		t.Fatalf("jwks hits = %d, want 1 cached fetch", jwksHits)
	}
}

func TestSupabaseJWTVerifierRateLimitsJWKSRefreshForUnknownKID(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	jwks := rsaJWKS(&privateKey.PublicKey, "kid-1")
	jwksHits := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		jwksHits += 1
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwks))
	}))
	t.Cleanup(server.Close)

	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	validToken := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, nil)
	unknownKIDToken := signedSupabaseToken(t, privateKey, "kid-missing", server.URL, now, nil)

	if _, err := verifier.VerifyAccessToken(context.Background(), validToken); err != nil {
		t.Fatalf("VerifyAccessToken valid token failed: %v", err)
	}
	if _, err := verifier.VerifyAccessToken(context.Background(), unknownKIDToken); !errors.Is(err, ErrAuthTokenInvalid) {
		t.Fatalf("error = %v, want ErrAuthTokenInvalid", err)
	}
	if _, err := verifier.VerifyAccessToken(context.Background(), unknownKIDToken); !errors.Is(err, ErrAuthTokenInvalid) {
		t.Fatalf("error = %v, want ErrAuthTokenInvalid", err)
	}
	if jwksHits != 2 {
		t.Fatalf("jwks hits = %d, want one cached fetch plus one rate-limited miss refresh", jwksHits)
	}
}

func TestSupabaseJWTVerifierRefreshesOnceForRotatedKID(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	oldKey := mustRSAKey(t)
	newKey := mustRSAKey(t)
	jwks := rsaJWKS(&oldKey.PublicKey, "kid-1")
	jwksHits := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		jwksHits += 1
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwks))
	}))
	t.Cleanup(server.Close)

	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	oldToken := signedSupabaseToken(t, oldKey, "kid-1", server.URL, now, nil)
	newToken := signedSupabaseToken(t, newKey, "kid-2", server.URL, now, nil)

	if _, err := verifier.VerifyAccessToken(context.Background(), oldToken); err != nil {
		t.Fatalf("VerifyAccessToken old token failed: %v", err)
	}

	jwks = rsaJWKS(&newKey.PublicKey, "kid-2")
	identity, err := verifier.VerifyAccessToken(context.Background(), newToken)
	if err != nil {
		t.Fatalf("VerifyAccessToken rotated token failed: %v", err)
	}
	if got := identity.UserID; got != "supabase-user-1" {
		t.Fatalf("user id = %q, want supabase-user-1", got)
	}
	if jwksHits != 2 {
		t.Fatalf("jwks hits = %d, want cached fetch plus one miss refresh", jwksHits)
	}
}

func TestSupabaseJWTVerifierCoalescesColdJWKSRefresh(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	jwks := rsaJWKS(&privateKey.PublicKey, "kid-1")
	var jwksHits atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		jwksHits.Add(1)
		time.Sleep(20 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwks))
	}))
	t.Cleanup(server.Close)

	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, nil)
	errs := make(chan error, 8)
	for range 8 {
		go func() {
			_, err := verifier.VerifyAccessToken(context.Background(), token)
			errs <- err
		}()
	}
	for range 8 {
		if err := <-errs; err != nil {
			t.Fatalf("VerifyAccessToken failed: %v", err)
		}
	}
	if got := jwksHits.Load(); got != 1 {
		t.Fatalf("jwks hits = %d, want one coalesced refresh", got)
	}
}

func TestSupabaseJWTVerifierRejectsAnonymousTokens(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	server := jwksServer(t, rsaJWKS(&privateKey.PublicKey, "kid-1"))
	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, func(claims *supabaseJWTClaims) {
		claims.IsAnonymous = true
	})

	_, err := verifier.VerifyAccessToken(context.Background(), token)
	if !errors.Is(err, ErrAuthTokenInvalid) {
		t.Fatalf("error = %v, want ErrAuthTokenInvalid", err)
	}
}

func TestSupabaseJWTVerifierRejectsNonAuthenticatedRole(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	server := jwksServer(t, rsaJWKS(&privateKey.PublicKey, "kid-1"))
	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, func(claims *supabaseJWTClaims) {
		claims.Role = "anon"
	})

	_, err := verifier.VerifyAccessToken(context.Background(), token)
	if !errors.Is(err, ErrAuthTokenInvalid) {
		t.Fatalf("error = %v, want ErrAuthTokenInvalid", err)
	}
}

func TestSupabaseJWTVerifierUsesConfiguredRole(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	server := jwksServer(t, rsaJWKS(&privateKey.PublicKey, "kid-1"))
	verifier, err := NewSupabaseJWTVerifier(SupabaseJWTVerifierOptions{
		SupabaseURL:  server.URL,
		HTTPClient:   server.Client(),
		Clock:        func() time.Time { return now },
		JWKSCacheTTL: time.Hour,
		Role:         "member",
	})
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifier failed: %v", err)
	}
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, func(claims *supabaseJWTClaims) {
		claims.Role = "member"
	})

	if _, err := verifier.VerifyAccessToken(context.Background(), token); err != nil {
		t.Fatalf("VerifyAccessToken failed: %v", err)
	}
}

func TestSupabaseJWTVerifierReportsJWKSOutageAsUnavailable(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	privateKey := mustRSAKey(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)

	verifier := mustSupabaseVerifier(t, server.URL, server.Client(), now)
	token := signedSupabaseToken(t, privateKey, "kid-1", server.URL, now, nil)

	_, err := verifier.VerifyAccessToken(context.Background(), token)
	if !errors.Is(err, ErrAuthVerifierUnavailable) {
		t.Fatalf("error = %v, want ErrAuthVerifierUnavailable", err)
	}
}

func TestSupabaseJWTVerifierSupportsLegacyHS256Secret(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 28, 1, 2, 3, 0, time.UTC)
	verifier, err := NewSupabaseJWTVerifier(SupabaseJWTVerifierOptions{
		SupabaseURL: "https://project.supabase.co",
		JWTSecret:   "legacy-secret",
		HTTPClient:  http.DefaultClient,
		Clock:       func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifier failed: %v", err)
	}
	token := signedSupabaseHS256Token(t, "legacy-secret", "https://project.supabase.co", now)

	identity, err := verifier.VerifyAccessToken(context.Background(), token)
	if err != nil {
		t.Fatalf("VerifyAccessToken failed: %v", err)
	}
	if got := identity.UserID; got != "supabase-user-1" {
		t.Fatalf("user id = %q, want supabase-user-1", got)
	}
}

func TestNewSupabaseJWTVerifierRejectsSchemeLessURL(t *testing.T) {
	t.Parallel()

	_, err := NewSupabaseJWTVerifier(SupabaseJWTVerifierOptions{
		SupabaseURL: "project.supabase.co",
		HTTPClient:  http.DefaultClient,
	})
	if !errors.Is(err, ErrSupabaseAuthNotConfigured) {
		t.Fatalf("error = %v, want ErrSupabaseAuthNotConfigured", err)
	}
}

func TestNewSupabaseJWTVerifierFromEnvAcceptsProjectURLAlias(t *testing.T) {
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_PROJECT_URL", "https://project.supabase.co")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "")
	t.Setenv("SUPABASE_JWT_SECRET", "")

	verifier, ok, err := NewSupabaseJWTVerifierFromEnv(http.DefaultClient)
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifierFromEnv failed: %v", err)
	}
	if !ok {
		t.Fatal("NewSupabaseJWTVerifierFromEnv returned ok=false")
	}
	if got := verifier.jwksEndpoint; got != "https://project.supabase.co/auth/v1/.well-known/jwks.json" {
		t.Fatalf("jwks endpoint = %q", got)
	}
}

func TestNewSupabaseJWTVerifierFromEnvPrefersProjectURL(t *testing.T) {
	t.Setenv("SUPABASE_URL", "https://alias.supabase.co")
	t.Setenv("SUPABASE_PROJECT_URL", "https://project.supabase.co")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "")
	t.Setenv("SUPABASE_JWT_SECRET", "")

	verifier, ok, err := NewSupabaseJWTVerifierFromEnv(http.DefaultClient)
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifierFromEnv failed: %v", err)
	}
	if !ok {
		t.Fatal("NewSupabaseJWTVerifierFromEnv returned ok=false")
	}
	if got := verifier.jwksEndpoint; got != "https://project.supabase.co/auth/v1/.well-known/jwks.json" {
		t.Fatalf("jwks endpoint = %q", got)
	}
}

func TestNewSupabaseJWTVerifierFromEnvIgnoresServerPublishableKey(t *testing.T) {
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_PROJECT_URL", "")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "publishable-key")
	t.Setenv("SUPABASE_JWT_SECRET", "")

	_, ok, err := NewSupabaseJWTVerifierFromEnv(http.DefaultClient)
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifierFromEnv failed: %v", err)
	}
	if ok {
		t.Fatal("NewSupabaseJWTVerifierFromEnv returned ok=true for publishable-key-only config")
	}
}

func TestNewSupabaseJWTVerifierFromEnvTreatsJWTSecretWithoutURLAsUnconfigured(t *testing.T) {
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_PROJECT_URL", "")
	t.Setenv("SUPABASE_PUBLISHABLE_KEY", "")
	t.Setenv("SUPABASE_JWT_SECRET", "legacy-secret")

	_, ok, err := NewSupabaseJWTVerifierFromEnv(http.DefaultClient)
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifierFromEnv failed: %v", err)
	}
	if ok {
		t.Fatal("NewSupabaseJWTVerifierFromEnv returned ok=true for partial config")
	}
}

func jwksServer(t *testing.T, jwks string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jwks))
	}))
	t.Cleanup(server.Close)
	return server
}

func mustSupabaseVerifier(t *testing.T, supabaseURL string, client *http.Client, now time.Time) *SupabaseJWTVerifier {
	t.Helper()
	verifier, err := NewSupabaseJWTVerifier(SupabaseJWTVerifierOptions{
		SupabaseURL:  supabaseURL,
		HTTPClient:   client,
		Clock:        func() time.Time { return now },
		JWKSCacheTTL: time.Hour,
	})
	if err != nil {
		t.Fatalf("NewSupabaseJWTVerifier failed: %v", err)
	}
	return verifier
}

func mustRSAKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey failed: %v", err)
	}
	return key
}

func rsaJWKS(key *rsa.PublicKey, kid string) string {
	return fmt.Sprintf(
		`{"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":%q,"n":%q,"e":%q}]}`,
		kid,
		base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
		base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
	)
}

func signedSupabaseToken(
	t *testing.T,
	key *rsa.PrivateKey,
	kid string,
	supabaseURL string,
	now time.Time,
	mutate func(*supabaseJWTClaims),
) string {
	t.Helper()
	claims := &supabaseJWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    supabaseURL + "/auth/v1",
			Subject:   "supabase-user-1",
			Audience:  jwt.ClaimStrings{defaultSupabaseJWTAudience},
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
		Role: defaultSupabaseJWTRole,
	}
	if mutate != nil {
		mutate(claims)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("SignedString failed: %v", err)
	}
	return signed
}

func signedSupabaseHS256Token(t *testing.T, secret string, supabaseURL string, now time.Time) string {
	t.Helper()
	claims := &supabaseJWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    supabaseURL + "/auth/v1",
			Subject:   "supabase-user-1",
			Audience:  jwt.ClaimStrings{defaultSupabaseJWTAudience},
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
		Role: defaultSupabaseJWTRole,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("SignedString failed: %v", err)
	}
	return signed
}
