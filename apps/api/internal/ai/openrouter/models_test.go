package openrouter

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/ai"
)

func catalog(t *testing.T, status int, body string) string {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer sk-test" {
			t.Errorf("Authorization = %q", got)
		}
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(server.Close)
	return server.URL
}

const fullParameters = `"supported_parameters":["max_tokens","response_format","structured_outputs"]`

func TestListModelsIntersectsTheAllowlistWithCapableCatalogRows(t *testing.T) {
	allowlist := []approvedModel{
		{ID: "anthropic/claude-opus-4.8"},
		{ID: "deepseek/deepseek-v4-flash"},
		{ID: "google/gemini-3-pro"},
		{ID: "mistral/large-3"},
		{ID: "qwen/qwen-4"},
	}
	body := `{"data":[
		{"id":"anthropic/claude-opus-4.8","name":"Claude Opus 4.8",` + fullParameters + `},
		{"id":"openai/gpt-6","name":"listed but unreviewed",` + fullParameters + `},
		{"id":"deepseek/deepseek-v4-flash","name":"lost a capability","supported_parameters":["response_format"]},
		{"id":"mistral/large-3","name":"no capability metadata"},
		{"id":"qwen/qwen-4","name":"first",` + fullParameters + `},
		{"id":"qwen/qwen-4","name":"duplicate",` + fullParameters + `}
	]}`
	url := catalog(t, http.StatusOK, body)

	models, err := listModels(context.Background(), url, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, allowlist)
	if err != nil {
		t.Fatalf("listModels: %v", err)
	}
	// Approved and listed with both parameters: in. Approved but absent (gemini), listed but not
	// reviewed (gpt-6), a lost capability, missing metadata and a duplicated row: all out.
	if len(models) != 1 || models[0].ID != "anthropic/claude-opus-4.8" || models[0].DisplayName != "Claude Opus 4.8" {
		t.Fatalf("models = %+v", models)
	}
}

func TestListModelsFailsClosed(t *testing.T) {
	allowlist := []approvedModel{{ID: "anthropic/claude-opus-4.8"}}

	empty := catalog(t, http.StatusOK, `{"data":[{"id":"openai/gpt-6",`+fullParameters+`}]}`)
	models, err := listModels(context.Background(), empty, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, allowlist)
	if err != nil || len(models) != 0 {
		t.Fatalf("empty intersection = %+v, %v; want no selectable model and no error", models, err)
	}

	unauthorized := catalog(t, http.StatusUnauthorized, `{"error":{"message":"`+vendorSecret+`"}}`)
	_, err = listModels(context.Background(), unauthorized, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, allowlist)
	var authFailed *ai.AuthFailedError
	if !errors.As(err, &authFailed) || strings.Contains(err.Error(), vendorSecret) {
		t.Fatalf("auth failure = %v, want a sanitized AuthFailedError", err)
	}

	outage := catalog(t, http.StatusServiceUnavailable, "")
	var rateLimited *ai.RateLimitedError
	if _, err := listModels(context.Background(), outage, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, allowlist); !errors.As(err, &rateLimited) {
		t.Fatalf("listing outage = %v, want RateLimitedError", err)
	}

	garbage := catalog(t, http.StatusOK, "<html>")
	if _, err := listModels(context.Background(), garbage, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, allowlist); !isMalformed(err) {
		t.Fatalf("garbage listing = %v, want MalformedStructuredOutputError", err)
	}

	if _, err := listModels(context.Background(), empty, ai.ProviderConfig{}, http.DefaultClient, allowlist); err == nil {
		t.Fatal("listing without a key must fail")
	}
}

func TestShippedAllowlistAdmitsNothingFromTheLiveCatalog(t *testing.T) {
	url := catalog(t, http.StatusOK, `{"data":[{"id":"anthropic/claude-opus-4.8",`+fullParameters+`}]}`)
	models, err := listModels(context.Background(), url, ai.ProviderConfig{APIKey: "sk-test"}, http.DefaultClient, approvedModels)
	if err != nil || len(models) != len(approvedModels) {
		t.Fatalf("models = %+v, %v", models, err)
	}
}

// The allowlist and the evaluation record stay one list (AI-19): every allowlisted id is an approved
// row of EVALUATION.md and every approved row is allowlisted.
func TestAllowlistMatchesApprovedEvaluation(t *testing.T) {
	file, err := os.Open("EVALUATION.md")
	if err != nil {
		t.Fatalf("open EVALUATION.md: %v", err)
	}
	defer file.Close()
	approvedRow := regexp.MustCompile("^\\|\\s*`?([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._:-]*)`?\\s*\\|.*\\|\\s*approved\\s*\\|\\s*$")
	var recorded []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		if match := approvedRow.FindStringSubmatch(scanner.Text()); match != nil {
			recorded = append(recorded, match[1])
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read EVALUATION.md: %v", err)
	}
	allowlisted := make([]string, 0, len(approvedModels))
	for _, entry := range approvedModels {
		allowlisted = append(allowlisted, entry.ID)
	}
	sort.Strings(recorded)
	sort.Strings(allowlisted)
	if strings.Join(recorded, ",") != strings.Join(allowlisted, ",") {
		t.Fatalf("approved in EVALUATION.md %v, allowlisted %v", recorded, allowlisted)
	}
}
