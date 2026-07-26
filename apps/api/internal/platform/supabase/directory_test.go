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
	accounts, hasMore, err := directory.ListUsers(context.Background(), 0, 50, "user@")
	if err != nil || hasMore || len(accounts) != 1 {
		t.Fatalf("ListUsers = %#v, hasMore %v, err %v", accounts, hasMore, err)
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
