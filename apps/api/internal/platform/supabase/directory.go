// Package supabase adapts the Supabase Auth Admin API into platform-owned account metadata.
// Product contexts translate these DTOs through their own consumer-owned ports at the
// composition root.
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrDirectoryUnavailable = errors.New("supabase account directory is unavailable")

// Account is account metadata owned by Supabase Auth. Product profile fields do not cross this
// platform boundary.
type Account struct {
	UserID          string
	Email           string
	EmailVerifiedAt time.Time
	SignupAt        time.Time
}

// Fake is the keyless in-memory directory used by tests and development. Production
// account-withdrawal composition rejects it because it cannot mutate credentials.
type Fake struct {
	Accounts         []Account
	IdentitiesByUser map[string][]string
	BannedUsers      map[string]bool
	DeletedUsers     map[string]bool
}

func (f Fake) ListUsers(_ context.Context, page int, pageSize int, query string) ([]Account, bool, error) {
	filtered := f.Accounts
	if q := strings.ToLower(strings.TrimSpace(query)); q != "" {
		filtered = nil
		for _, account := range f.Accounts {
			if strings.Contains(strings.ToLower(account.Email), q) || strings.Contains(strings.ToLower(account.UserID), q) {
				filtered = append(filtered, account)
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
	return append([]Account(nil), filtered[start:end]...), hasMore, nil
}

func (f Fake) EmailFor(_ context.Context, userID string) (string, error) {
	account, _ := f.account(userID)
	return account.Email, nil
}

func (f Fake) EmailVerifiedAt(_ context.Context, userID string) (time.Time, error) {
	account, _ := f.account(userID)
	return account.EmailVerifiedAt, nil
}

func (f Fake) Identities(_ context.Context, userID string) ([]string, error) {
	identities, ok := f.IdentitiesByUser[userID]
	if !ok {
		return nil, ErrDirectoryUnavailable
	}
	return append([]string(nil), identities...), nil
}

func (f Fake) SetUserBanned(_ context.Context, userID string, banned bool) error {
	if f.BannedUsers != nil {
		f.BannedUsers[userID] = banned
	}
	return nil
}

func (f Fake) DeleteUser(_ context.Context, userID string) error {
	if f.DeletedUsers != nil {
		f.DeletedUsers[userID] = true
	}
	return nil
}

func (f Fake) account(userID string) (Account, bool) {
	for _, account := range f.Accounts {
		if account.UserID == userID {
			return account, true
		}
	}
	return Account{}, false
}

// Directory calls the Supabase Auth (GoTrue) Admin API with a server-only service-role key.
type Directory struct {
	baseURL    string
	serviceKey string
	client     *http.Client
}

// CredentialMutationsAvailable distinguishes the real server-only Admin API adapter
// from keyless read fallbacks at composition time. Production roots use it to refuse
// a withdrawal worker that could delete product rows without deleting the credential.
func CredentialMutationsAvailable(source any) bool {
	switch source.(type) {
	case Directory, *Directory:
		return true
	default:
		return false
	}
}

// NewDirectory returns ok=false when the URL or service-role key is absent, allowing the
// composition root to select the keyless Fake.
func NewDirectory(baseURL string, serviceKey string, client *http.Client) (Directory, bool) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	serviceKey = strings.TrimSpace(serviceKey)
	if baseURL == "" || serviceKey == "" {
		return Directory{}, false
	}
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return Directory{baseURL: baseURL, serviceKey: serviceKey, client: client}, true
}

type supabaseIdentity struct {
	Provider string `json:"provider"`
}

type supabaseUser struct {
	ID               string             `json:"id"`
	Email            string             `json:"email"`
	EmailConfirmedAt string             `json:"email_confirmed_at"`
	CreatedAt        string             `json:"created_at"`
	Identities       []supabaseIdentity `json:"identities"`
}

type supabaseListResponse struct {
	Users []supabaseUser `json:"users"`
}

// ListUsers applies search client-side to one GoTrue page because the admin endpoint has no
// portable prefix filter.
func (s Directory) ListUsers(ctx context.Context, page int, pageSize int, query string) ([]Account, bool, error) {
	endpoint := fmt.Sprintf("%s/auth/v1/admin/users?page=%d&per_page=%d", s.baseURL, page+1, pageSize)
	var body supabaseListResponse
	if err := s.get(ctx, endpoint, &body); err != nil {
		return nil, false, err
	}
	hasMore := len(body.Users) >= pageSize
	q := strings.ToLower(strings.TrimSpace(query))
	accounts := make([]Account, 0, len(body.Users))
	for _, user := range body.Users {
		if q != "" && !strings.Contains(strings.ToLower(user.Email), q) && !strings.Contains(strings.ToLower(user.ID), q) {
			continue
		}
		accounts = append(accounts, mapAccount(user))
	}
	return accounts, hasMore, nil
}

func (s Directory) EmailFor(ctx context.Context, userID string) (string, error) {
	user, err := s.user(ctx, userID)
	if err != nil {
		return "", err
	}
	return user.Email, nil
}

func (s Directory) EmailVerifiedAt(ctx context.Context, userID string) (time.Time, error) {
	user, err := s.user(ctx, userID)
	if err != nil {
		return time.Time{}, err
	}
	return parseTime(user.EmailConfirmedAt), nil
}

func (s Directory) Identities(ctx context.Context, userID string) ([]string, error) {
	user, err := s.user(ctx, userID)
	if err != nil {
		return nil, err
	}
	identities := make([]string, 0, len(user.Identities))
	for _, identity := range user.Identities {
		identities = append(identities, identity.Provider)
	}
	return identities, nil
}

// SetUserBanned uses GoTrue's server-only admin update contract. A century-long
// duration is Supabase's documented durable-ban shape; "none" removes a ban.
func (s Directory) SetUserBanned(ctx context.Context, userID string, banned bool) error {
	duration := "none"
	if banned {
		duration = "876000h"
	}
	body, err := json.Marshal(map[string]string{"ban_duration": duration})
	if err != nil {
		return err
	}
	return s.mutateUser(ctx, http.MethodPut, userID, body)
}

// DeleteUser permanently removes the Auth user. A missing user is an idempotent
// success so a crash after credential deletion can replay the sweep safely.
func (s Directory) DeleteUser(ctx context.Context, userID string) error {
	return s.mutateUser(ctx, http.MethodDelete, userID, nil)
}

func (s Directory) user(ctx context.Context, userID string) (supabaseUser, error) {
	endpoint := fmt.Sprintf("%s/auth/v1/admin/users/%s", s.baseURL, url.PathEscape(userID))
	var user supabaseUser
	if err := s.get(ctx, endpoint, &user); err != nil {
		return supabaseUser{}, err
	}
	return user, nil
}

func (s Directory) get(ctx context.Context, endpoint string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	request.Header.Set("apikey", s.serviceKey)
	request.Header.Set("Authorization", "Bearer "+s.serviceKey)
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("supabase admin api: status %s", strconv.Itoa(response.StatusCode))
	}
	return json.NewDecoder(response.Body).Decode(out)
}

func (s Directory) mutateUser(ctx context.Context, method string, userID string, body []byte) error {
	endpoint := fmt.Sprintf("%s/auth/v1/admin/users/%s", s.baseURL, url.PathEscape(userID))
	request, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("apikey", s.serviceKey)
	request.Header.Set("Authorization", "Bearer "+s.serviceKey)
	if len(body) > 0 {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode == http.StatusNotFound {
		return nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("supabase admin api: status %s", strconv.Itoa(response.StatusCode))
	}
	return nil
}

func mapAccount(user supabaseUser) Account {
	return Account{
		UserID:          user.ID,
		Email:           user.Email,
		EmailVerifiedAt: parseTime(user.EmailConfirmedAt),
		SignupAt:        parseTime(user.CreatedAt),
	}
}

func parseTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}
