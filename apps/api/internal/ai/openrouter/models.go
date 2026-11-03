package openrouter

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"sort"
	"strings"

	"github.com/cosimosi/api/internal/ai"
)

// The two parameters a curated model must advertise: every completion sends `response_format`
// with a strict JSON Schema, and `require_parameters` routes only to endpoints honouring both.
var requiredParameters = []string{"structured_outputs", "response_format"}

// ListModels answers the selectable LLM models (AI-18): the curated allowlist intersected with the
// live OpenRouter catalog rows that still advertise every required parameter. It fails closed — a
// listing or auth failure is an error, and a row with missing or ambiguous capability metadata is
// left out — and it never admits a model because the catalog lists it.
func ListModels(ctx context.Context, cfg ai.ProviderConfig) ([]ai.ModelInfo, error) {
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		// See New: production model listing receives the same root-owned client.
		httpClient = http.DefaultClient
	}
	return listModels(ctx, modelsEndpoint, cfg, httpClient, approvedModels)
}

type catalogRow struct {
	ID                  string    `json:"id"`
	CanonicalSlug       string    `json:"canonical_slug"`
	Name                string    `json:"name"`
	SupportedParameters *[]string `json:"supported_parameters"`
}

func listModels(
	ctx context.Context,
	url string,
	cfg ai.ProviderConfig,
	httpClient *http.Client,
	allowlist []approvedModel,
) ([]ai.ModelInfo, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("openrouter: api key is required")
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	httpReq.Header.Set("Authorization", "Bearer "+key)

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("openrouter transport error: %w", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		drainErrorBody(resp.Body)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, mapStatus(resp)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("openrouter response body read: %w", err),
		}
	}
	if len(raw) > maxResponseBytes {
		return nil, malformed(fmt.Sprintf("model list exceeds %d bytes", maxResponseBytes))
	}
	var decoded struct {
		Data []catalogRow `json:"data"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, malformed("model list is not JSON")
	}
	return curatedIntersection(decoded.Data, allowlist), nil
}

// curatedIntersection keeps the allowlisted models whose single catalog row advertises every required
// parameter, in allowlist id order. A model listed twice is ambiguous and left out, as is one whose
// row carries no parameter list at all.
func curatedIntersection(rows []catalogRow, allowlist []approvedModel) []ai.ModelInfo {
	byID := make(map[string][]catalogRow, len(rows))
	for _, row := range rows {
		id := strings.ToLower(strings.TrimSpace(row.ID))
		if id == "" {
			continue
		}
		byID[id] = append(byID[id], row)
	}
	out := make([]ai.ModelInfo, 0, len(allowlist))
	for _, entry := range allowlist {
		matches := byID[strings.ToLower(entry.ID)]
		if len(matches) != 1 {
			continue
		}
		row := matches[0]
		if row.SupportedParameters == nil || !advertisesAll(*row.SupportedParameters) {
			continue
		}
		out = append(out, ai.ModelInfo{ID: entry.ID, DisplayName: strings.TrimSpace(row.Name)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func advertisesAll(parameters []string) bool {
	for _, required := range requiredParameters {
		if !slices.Contains(parameters, required) {
			return false
		}
	}
	return true
}
