package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/golang-jwt/jwt/v5"
)

var ErrSupabaseAuthNotConfigured = errors.New("supabase auth is not configured")

const (
	defaultSupabaseJWKSCacheTTL            = time.Duration(values.SupabaseAuthJwksCacheTtlMs) * time.Millisecond
	defaultSupabaseJWKSMissRefreshInterval = time.Duration(values.SupabaseAuthJwksMissRefreshIntervalMs) * time.Millisecond
	defaultSupabaseJWTAudience             = "authenticated"
	defaultSupabaseJWTRole                 = "authenticated"
)

type SupabaseJWTVerifier struct {
	jwksEndpoint string
	issuer       string
	audience     string
	role         string
	jwtSecret    string
	httpClient   *http.Client
	clock        func() time.Time
	jwksCacheTTL time.Duration

	mu              sync.RWMutex
	cachedKeyfunc   keyfunc.Keyfunc
	keyfuncExpires  time.Time
	refreshing      chan struct{}
	nextMissRefresh time.Time
}

type SupabaseJWTVerifierOptions struct {
	SupabaseURL  string
	JWTSecret    string
	HTTPClient   *http.Client
	Clock        func() time.Time
	JWKSCacheTTL time.Duration
	Audience     string
	Role         string
}

type supabaseJWTClaims struct {
	jwt.RegisteredClaims
	Role        string `json:"role"`
	IsAnonymous bool   `json:"is_anonymous"`
}

func NewSupabaseJWTVerifier(opts SupabaseJWTVerifierOptions) (*SupabaseJWTVerifier, error) {
	if strings.TrimSpace(opts.SupabaseURL) == "" {
		return nil, ErrSupabaseAuthNotConfigured
	}

	baseURL, err := parseSupabaseURL(opts.SupabaseURL)
	if err != nil {
		return nil, err
	}

	client := opts.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	clock := opts.Clock
	if clock == nil {
		clock = time.Now
	}
	cacheTTL := opts.JWKSCacheTTL
	if cacheTTL <= 0 {
		cacheTTL = defaultSupabaseJWKSCacheTTL
	}
	audience := opts.Audience
	if audience == "" {
		audience = defaultSupabaseJWTAudience
	}
	role := opts.Role
	if role == "" {
		role = defaultSupabaseJWTRole
	}

	return &SupabaseJWTVerifier{
		jwksEndpoint: supabaseEndpoint(baseURL, "/auth/v1/.well-known/jwks.json"),
		issuer:       supabaseEndpoint(baseURL, "/auth/v1"),
		audience:     audience,
		role:         role,
		jwtSecret:    opts.JWTSecret,
		httpClient:   client,
		clock:        clock,
		jwksCacheTTL: cacheTTL,
	}, nil
}

func NewSupabaseJWTVerifierFromEnv(httpClient *http.Client) (*SupabaseJWTVerifier, bool, error) {
	supabaseURL := firstNonEmpty(os.Getenv("SUPABASE_PROJECT_URL"), os.Getenv("SUPABASE_URL"))
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if supabaseURL == "" {
		return nil, false, nil
	}
	verifier, err := NewSupabaseJWTVerifier(SupabaseJWTVerifierOptions{
		SupabaseURL: supabaseURL,
		JWTSecret:   jwtSecret,
		HTTPClient:  httpClient,
	})
	if err != nil {
		return nil, false, err
	}
	return verifier, true, nil
}

func (v *SupabaseJWTVerifier) VerifyAccessToken(ctx context.Context, token string) (UserIdentity, error) {
	if strings.TrimSpace(token) == "" {
		return UserIdentity{}, ErrAuthTokenInvalid
	}

	claims := &supabaseJWTClaims{}
	parser := jwt.NewParser(
		jwt.WithValidMethods(v.validMethods()),
		jwt.WithAudience(v.audience),
		jwt.WithIssuer(v.issuer),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(v.clock),
	)
	parsed, err := parser.ParseWithClaims(token, claims, v.keyfunc(ctx))
	if errors.Is(err, ErrAuthVerifierUnavailable) {
		return UserIdentity{}, err
	}
	if err != nil || parsed == nil || !parsed.Valid {
		return UserIdentity{}, fmt.Errorf("%w: %v", ErrAuthTokenInvalid, err)
	}

	if claims.Subject == "" {
		return UserIdentity{}, fmt.Errorf("%w: missing subject", ErrAuthTokenInvalid)
	}
	if claims.Role != v.role || claims.IsAnonymous {
		return UserIdentity{}, fmt.Errorf("%w: unsupported Supabase role", ErrAuthTokenInvalid)
	}

	return UserIdentity{UserID: claims.Subject}, nil
}

func (v *SupabaseJWTVerifier) validMethods() []string {
	methods := []string{"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"}
	if v.jwtSecret != "" {
		methods = append(methods, "HS256")
	}
	return methods
}

func (v *SupabaseJWTVerifier) keyfunc(ctx context.Context) jwt.Keyfunc {
	return func(token *jwt.Token) (any, error) {
		alg, _ := token.Header["alg"].(string)
		if strings.HasPrefix(alg, "HS") {
			if v.jwtSecret == "" {
				return nil, ErrAuthTokenInvalid
			}
			return []byte(v.jwtSecret), nil
		}

		kf, err := v.currentKeyfunc(ctx)
		if err != nil {
			return nil, err
		}
		key, err := kf.KeyfuncCtx(ctx)(token)
		if err == nil || !v.shouldRefreshAfterKeyMiss() {
			return key, err
		}

		kf, err = v.refreshKeyfunc(ctx, true)
		if err != nil {
			return nil, err
		}
		return kf.KeyfuncCtx(ctx)(token)
	}
}

func (v *SupabaseJWTVerifier) currentKeyfunc(ctx context.Context) (keyfunc.Keyfunc, error) {
	now := v.clock()
	v.mu.RLock()
	kf := v.cachedKeyfunc
	expires := v.keyfuncExpires
	v.mu.RUnlock()
	if kf != nil && now.Before(expires) {
		return kf, nil
	}
	return v.refreshKeyfunc(ctx, false)
}

func (v *SupabaseJWTVerifier) refreshKeyfunc(ctx context.Context, force bool) (keyfunc.Keyfunc, error) {
	for {
		v.mu.Lock()
		now := v.clock()
		if !force && v.cachedKeyfunc != nil && now.Before(v.keyfuncExpires) {
			kf := v.cachedKeyfunc
			v.mu.Unlock()
			return kf, nil
		}
		if v.refreshing != nil {
			done := v.refreshing
			v.mu.Unlock()
			select {
			case <-done:
				continue
			case <-ctx.Done():
				return nil, fmt.Errorf("%w: wait for Supabase JWKS refresh: %v", ErrAuthVerifierUnavailable, ctx.Err())
			}
		}
		done := make(chan struct{})
		v.refreshing = done
		v.mu.Unlock()

		kf, err := v.fetchKeyfunc(ctx)

		v.mu.Lock()
		if err == nil {
			v.cachedKeyfunc = kf
			v.keyfuncExpires = v.clock().Add(v.jwksCacheTTL)
		}
		if v.refreshing == done {
			close(done)
			v.refreshing = nil
		}
		v.mu.Unlock()
		return kf, err
	}
}

func (v *SupabaseJWTVerifier) shouldRefreshAfterKeyMiss() bool {
	v.mu.Lock()
	defer v.mu.Unlock()

	now := v.clock()
	if now.Before(v.nextMissRefresh) {
		return false
	}
	v.nextMissRefresh = now.Add(defaultSupabaseJWKSMissRefreshInterval)
	return true
}

func (v *SupabaseJWTVerifier) fetchKeyfunc(ctx context.Context) (keyfunc.Keyfunc, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: create Supabase JWKS request: %v", ErrAuthVerifierUnavailable, err)
	}
	req.Header.Set("Accept", "application/json")

	res, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: fetch Supabase JWKS: %v", ErrAuthVerifierUnavailable, err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1024))
		return nil, fmt.Errorf("%w: Supabase JWKS returned %s", ErrAuthVerifierUnavailable, res.Status)
	}

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("%w: read Supabase JWKS: %v", ErrAuthVerifierUnavailable, err)
	}
	kf, err := keyfunc.NewJWKSetJSON(json.RawMessage(raw))
	if err != nil {
		return nil, fmt.Errorf("%w: parse Supabase JWKS: %v", ErrAuthVerifierUnavailable, err)
	}
	return kf, nil
}

func parseSupabaseURL(raw string) (*url.URL, error) {
	baseURL, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("parse Supabase URL: %w", err)
	}
	if baseURL.Scheme == "" || baseURL.Host == "" {
		return nil, fmt.Errorf("%w: Supabase URL must include scheme and host", ErrSupabaseAuthNotConfigured)
	}
	if baseURL.Scheme != "http" && baseURL.Scheme != "https" {
		return nil, fmt.Errorf("%w: Supabase URL must use http or https", ErrSupabaseAuthNotConfigured)
	}
	baseURL.Path = strings.TrimRight(baseURL.Path, "/")
	baseURL.RawQuery = ""
	baseURL.Fragment = ""
	return baseURL, nil
}

func supabaseEndpoint(baseURL *url.URL, suffix string) string {
	endpoint := *baseURL
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + suffix
	return endpoint.String()
}

func firstNonEmpty(candidates ...string) string {
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) != "" {
			return strings.TrimSpace(candidate)
		}
	}
	return ""
}
