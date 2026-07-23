// Package directory provides the admin.AccountDirectory concretes (the admin console): a Supabase Auth Admin
// API adapter for enumerating accounts (id, email, signup) and a keyless in-memory fake for
// tests/dev. It exposes only account identity metadata — never memory content ([I2]).
package directory

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/admin"
)

// Fake is the keyless in-memory directory for tests/dev (and the production fallback until a
// Supabase service-role key is configured). It enumerates a caller-supplied account set; empty by
// default (a dev instance without Supabase shows an empty user list rather than failing).
type Fake struct {
	Accounts []admin.DirectoryAccount
}

func (f Fake) ListUsers(_ context.Context, page int, pageSize int, query string) ([]admin.DirectoryAccount, bool, error) {
	filtered := f.Accounts
	if q := strings.ToLower(strings.TrimSpace(query)); q != "" {
		filtered = nil
		for _, acct := range f.Accounts {
			if strings.Contains(strings.ToLower(acct.Email), q) || strings.Contains(strings.ToLower(acct.UserID), q) {
				filtered = append(filtered, acct)
			}
		}
	}
	start := page * pageSize
	if start >= len(filtered) {
		return nil, false, nil
	}
	end := start + pageSize
	hasMore := end < len(filtered)
	if end > len(filtered) {
		end = len(filtered)
	}
	return append([]admin.DirectoryAccount(nil), filtered[start:end]...), hasMore, nil
}

func (f Fake) EmailFor(_ context.Context, userID string) (string, error) {
	for _, acct := range f.Accounts {
		if acct.UserID == userID {
			return acct.Email, nil
		}
	}
	return "", nil
}

// Supabase adapts the Supabase Auth (GoTrue) Admin API. It requires the project URL and a
// service-role key (server-only). Search is applied client-side over the returned page (the admin
// list endpoint has no portable prefix filter); the limitation is documented on ListUsers.
type Supabase struct {
	baseURL    string
	serviceKey string
	client     *http.Client
}

// NewSupabase builds the adapter; ok is false when the URL or service key is absent, so the caller
// falls back to the keyless Fake.
func NewSupabase(baseURL string, serviceKey string, client *http.Client) (Supabase, bool) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	serviceKey = strings.TrimSpace(serviceKey)
	if baseURL == "" || serviceKey == "" {
		return Supabase{}, false
	}
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return Supabase{baseURL: baseURL, serviceKey: serviceKey, client: client}, true
}

type supabaseUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}

type supabaseListResponse struct {
	Users []supabaseUser `json:"users"`
}

// ListUsers enumerates one page of accounts. NOTE: the query is applied client-side over the page,
// so search is best-effort across the whole directory — sufficient for an operator console.
func (s Supabase) ListUsers(ctx context.Context, page int, pageSize int, query string) ([]admin.DirectoryAccount, bool, error) {
	endpoint := fmt.Sprintf("%s/auth/v1/admin/users?page=%d&per_page=%d",
		s.baseURL, page+1, pageSize) // GoTrue pages are 1-based
	var body supabaseListResponse
	if err := s.get(ctx, endpoint, &body); err != nil {
		return nil, false, err
	}
	// A full page implies there may be another (GoTrue does not always return a total).
	hasMore := len(body.Users) >= pageSize
	q := strings.ToLower(strings.TrimSpace(query))
	accounts := make([]admin.DirectoryAccount, 0, len(body.Users))
	for _, u := range body.Users {
		if q != "" && !strings.Contains(strings.ToLower(u.Email), q) && !strings.Contains(strings.ToLower(u.ID), q) {
			continue
		}
		accounts = append(accounts, admin.DirectoryAccount{
			UserID:   u.ID,
			Email:    u.Email,
			SignupAt: parseTime(u.CreatedAt),
		})
	}
	return accounts, hasMore, nil
}

func (s Supabase) EmailFor(ctx context.Context, userID string) (string, error) {
	endpoint := fmt.Sprintf("%s/auth/v1/admin/users/%s", s.baseURL, url.PathEscape(userID))
	var u supabaseUser
	if err := s.get(ctx, endpoint, &u); err != nil {
		return "", err
	}
	return u.Email, nil
}

func (s Supabase) get(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	// GoTrue admin calls need both the apikey and a service-role bearer.
	req.Header.Set("apikey", s.serviceKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("supabase admin api: status %s", strconv.Itoa(resp.StatusCode))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func parseTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t
	}
	return time.Time{}
}
