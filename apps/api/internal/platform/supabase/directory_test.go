package supabase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestDirectoryReturnsPlatformOwnedAccountMetadata(t *testing.T) {
	t.Parallel()
	const serviceKey = "service-role"
	handler := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("apikey") != serviceKey || request.Header.Get("Authorization") != "Bearer "+serviceKey {
			t.Errorf("missing service-role headers: %#v", request.Header)
			http.Error(response, "missing service-role headers", http.StatusUnauthorized)
			return
		}
		response.Header().Set("content-type", "application/json")
		switch request.URL.Path {
		case "/auth/v1/admin/users":
			_, _ = fmt.Fprint(response, `{"users":[{"id":"u1","email":"user@example.com","email_confirmed_at":"2026-07-01T02:03:04Z","created_at":"2026-06-01T01:02:03Z","identities":[{"provider":"google"}]}]}`)
		case "/auth/v1/admin/users/u1":
			_, _ = fmt.Fprint(response, `{"id":"u1","email":"user@example.com","email_confirmed_at":"2026-07-01T02:03:04Z","created_at":"2026-06-01T01:02:03Z","identities":[{"provider":"google"},{"provider":"email"}]}`)
		default:
			http.NotFound(response, request)
		}
	})
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	directory, ok := NewDirectory(server.URL, serviceKey, server.Client())
	if !ok {
		t.Fatal("NewDirectory returned ok=false")
	}
	accounts, err := directory.ListUserPage(context.Background(), 0, 50)
	if err != nil || len(accounts) != 1 {
		t.Fatalf("ListUserPage = %#v, err %v", accounts, err)
	}
	if accounts[0].UserID != "u1" || accounts[0].Email != "user@example.com" ||
		!accounts[0].SignupAt.Equal(time.Date(2026, 6, 1, 1, 2, 3, 0, time.UTC)) {
		t.Fatalf("account = %#v", accounts[0])
	}
	email, err := directory.EmailFor(context.Background(), "u1")
	if err != nil || email != "user@example.com" {
		t.Fatalf("EmailFor = %q, %v", email, err)
	}
	verifiedAt, err := directory.EmailVerifiedAt(context.Background(), "u1")
	if err != nil || !verifiedAt.Equal(time.Date(2026, 7, 1, 2, 3, 4, 0, time.UTC)) {
		t.Fatalf("EmailVerifiedAt = %v, %v", verifiedAt, err)
	}
	identities, err := directory.Identities(context.Background(), "u1")
	if err != nil || len(identities) != 2 || identities[0] != "google" || identities[1] != "email" {
		t.Fatalf("Identities = %#v, %v", identities, err)
	}
}

// The directory pages and nothing more: page n is GoTrue's page n+1 at exactly the requested size,
// with no clamp, lookahead or filter.
func TestDirectoryListUserPageReadsOneRawProviderPage(t *testing.T) {
	t.Parallel()
	var requested []string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requested = append(requested, request.URL.Query().Get("page")+"/"+request.URL.Query().Get("per_page"))
		response.Header().Set("content-type", "application/json")
		_, _ = fmt.Fprint(response, `{"users":[{"id":"u1"},{"id":"u2"}]}`)
	}))
	t.Cleanup(server.Close)
	directory, _ := NewDirectory(server.URL, "service-role", server.Client())

	accounts, err := directory.ListUserPage(context.Background(), 2, 500)
	if err != nil || len(accounts) != 2 || accounts[0].UserID != "u1" {
		t.Fatalf("ListUserPage = %#v, err %v", accounts, err)
	}
	if want := []string{"3/500"}; !reflect.DeepEqual(requested, want) {
		t.Fatalf("provider requests = %v, want %v", requested, want)
	}
}

func TestDirectoryFallsBackOnlyWhenConfigurationIsAbsent(t *testing.T) {
	t.Parallel()
	if _, ok := NewDirectory("", "key", nil); ok {
		t.Fatal("empty URL configured a directory")
	}
	if _, ok := NewDirectory("https://example.com", "", nil); ok {
		t.Fatal("empty service key configured a directory")
	}
	if _, err := (Fake{}).Identities(context.Background(), "u1"); !errors.Is(err, ErrDirectoryUnavailable) {
		t.Fatalf("keyless identity lookup err = %v, want ErrDirectoryUnavailable", err)
	}
}

func TestDirectoryBansUnbansAndDeletesUsersThroughAdminAPI(t *testing.T) {
	t.Parallel()
	const serviceKey = "service-role"
	var requests []string
	handler := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("apikey") != serviceKey ||
			request.Header.Get("Authorization") != "Bearer "+serviceKey {
			http.Error(response, "missing service role", http.StatusUnauthorized)
			return
		}
		var body map[string]string
		if request.Method == http.MethodPut {
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Errorf("decode body: %v", err)
			}
		}
		requests = append(requests, request.Method+" "+request.URL.Path+" "+body["ban_duration"])
		if strings.Contains(request.URL.Path, "missing") {
			http.NotFound(response, request)
			return
		}
		response.WriteHeader(http.StatusNoContent)
	})
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	directory, ok := NewDirectory(server.URL, serviceKey, server.Client())
	if !ok {
		t.Fatal("NewDirectory returned ok=false")
	}
	ctx := context.Background()
	if err := directory.SetUserBanned(ctx, "u1", true); err != nil {
		t.Fatalf("SetUserBanned(true): %v", err)
	}
	if err := directory.SetUserBanned(ctx, "u1", false); err != nil {
		t.Fatalf("SetUserBanned(false): %v", err)
	}
	if err := directory.DeleteUser(ctx, "u1"); err != nil {
		t.Fatalf("DeleteUser: %v", err)
	}
	if err := directory.DeleteUser(ctx, "missing"); err != nil {
		t.Fatalf("DeleteUser(missing): %v", err)
	}
	want := []string{
		"PUT /auth/v1/admin/users/u1 876000h",
		"PUT /auth/v1/admin/users/u1 none",
		"DELETE /auth/v1/admin/users/u1 ",
		"DELETE /auth/v1/admin/users/missing ",
	}
	if !reflect.DeepEqual(requests, want) {
		t.Fatalf("requests = %#v, want %#v", requests, want)
	}
}

// countingBody is an endless response body that counts what the client reads and whether it closed.
type countingBody struct {
	read   int
	closed bool
	chunk  []byte
}

func (b *countingBody) Read(p []byte) (int, error) {
	n := copy(p, b.chunk)
	b.read += n
	return n, nil
}

func (b *countingBody) Close() error {
	b.closed = true
	return nil
}

type bodyTransport struct {
	status int
	body   *countingBody
}

func (t bodyTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: t.status, Body: t.body, Header: http.Header{}, Request: request}, nil
}

func endlessDirectory(t *testing.T, status int, chunk string) (Directory, *countingBody) {
	t.Helper()
	body := &countingBody{chunk: []byte(chunk)}
	directory, ok := NewDirectory("https://example.supabase.co", "service-role", &http.Client{Transport: bodyTransport{status: status, body: body}})
	if !ok {
		t.Fatal("NewDirectory returned ok=false")
	}
	return directory, body
}

// A vendor body past the cap fails closed rather than being decoded into memory.
func TestDirectoryRefusesAnOversizedResponse(t *testing.T) {
	t.Parallel()
	directory, body := endlessDirectory(t, http.StatusOK, `{"users":[`+strings.Repeat(`{"id":"u"},`, 64))
	if _, err := directory.ListUserPage(context.Background(), 0, 50); !errors.Is(err, ErrDirectoryResponseTooLarge) {
		t.Fatalf("oversized page err = %v, want ErrDirectoryResponseTooLarge", err)
	}
	if body.read > supabaseDirectoryMaxBodyBytes+1+supabaseDirectoryErrorDrainBytes+len(body.chunk) || !body.closed {
		t.Fatalf("read %d bytes, closed %v; want a bounded read and a closed body", body.read, body.closed)
	}
}

// A non-2xx body is drained through a bounded reader, never read in full.
func TestDirectoryDrainsErrorBodiesBoundedly(t *testing.T) {
	t.Parallel()
	for name, call := range map[string]func(Directory) error{
		"read": func(d Directory) error {
			_, err := d.EmailFor(context.Background(), "u1")
			return err
		},
		"mutation": func(d Directory) error { return d.DeleteUser(context.Background(), "u1") },
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			directory, body := endlessDirectory(t, http.StatusBadGateway, "upstream error page ")
			if err := call(directory); err == nil || !strings.Contains(err.Error(), "502") {
				t.Fatalf("error body call err = %v, want the status", err)
			}
			if body.read == 0 || body.read > supabaseDirectoryErrorDrainBytes+len(body.chunk) || !body.closed {
				t.Fatalf("read %d bytes, closed %v; want a drain up to the bound and a closed body", body.read, body.closed)
			}
		})
	}
}
