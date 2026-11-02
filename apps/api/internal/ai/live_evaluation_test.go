package ai_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	ai "github.com/cosimosi/api/internal/ai"
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/deepseek"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

const (
	liveEvalEnabledEnv  = "COSIMOSI_LIVE_LLM_EVAL"
	liveEvalProviderEnv = "COSIMOSI_LIVE_LLM_EVAL_PROVIDER"
	liveEvalAPIKeyEnv   = "COSIMOSI_LIVE_LLM_EVAL_API_KEY"
	liveEvalModelEnv    = "COSIMOSI_LIVE_LLM_EVAL_MODEL"
	liveEvalWarmupsEnv  = "COSIMOSI_LIVE_LLM_EVAL_WARMUPS"
	liveEvalSamplesEnv  = "COSIMOSI_LIVE_LLM_EVAL_SAMPLES"

	maxObservedResponseBytes = 8 << 20
)

// TestLiveLLMEvaluation is deliberately opt-in. It exercises the production port adapters over a
// synthetic Korean corpus while retaining schema/domain validation, metering, and cache behavior.
// The caller supplies a fresh synthetic user scope per sample so the identical-input cache cannot
// turn a measured network sample into a local hit.
func TestLiveLLMEvaluation(t *testing.T) {
	if os.Getenv(liveEvalEnabledEnv) != "1" {
		t.Skipf("set %s=1 to run billable live evaluation", liveEvalEnabledEnv)
	}

	provider := strings.ToLower(strings.TrimSpace(os.Getenv(liveEvalProviderEnv)))
	model := strings.TrimSpace(os.Getenv(liveEvalModelEnv))
	apiKey := strings.TrimSpace(os.Getenv(liveEvalAPIKeyEnv))
	if provider == "" || model == "" || apiKey == "" {
		t.Fatalf("%s, %s, and %s are required", liveEvalProviderEnv, liveEvalModelEnv, liveEvalAPIKeyEnv)
	}
	warmups := evalCount(t, liveEvalWarmupsEnv, 1, true)
	samples := evalCount(t, liveEvalSamplesEnv, 5, false)

	corpus := loadEvaluationCorpus(t)
	observer := &usageObserverTransport{base: http.DefaultTransport}
	httpClient := &http.Client{Transport: observer, Timeout: 5 * time.Minute}
	adapters, err := ai.NewAdapters(ai.FactoryOptions{
		LLM: ai.CapabilityConfig{Provider: provider, APIKey: apiKey, Model: model},
		HTTPClients: ai.HTTPClients{
			LLMByProvider: map[string]*http.Client{provider: httpClient},
		},
	})
	if err != nil {
		t.Fatalf("build %s/%s adapter: %v", provider, model, err)
	}

	t.Logf("EVAL_CONFIG provider=%s model=%s corpus_version=%d cases=%d warmups=%d samples=%d",
		provider, model, corpus.Version, len(corpus.Cases), warmups, samples)

	for warmup := 0; warmup < warmups; warmup++ {
		for _, testCase := range corpus.Cases {
			ctx := evaluationContext(provider, testCase.ID, "warmup", warmup)
			_, _ = evaluateCase(ctx, adapters, testCase)
			observer.take()
		}
	}

	latencies := make(map[string][]time.Duration, len(corpus.Cases))
	failures := 0
	for sample := 0; sample < samples; sample++ {
		for _, testCase := range corpus.Cases {
			ctx := evaluationContext(provider, testCase.ID, "sample", sample)
			started := time.Now()
			outcome, evalErr := evaluateCase(ctx, adapters, testCase)
			elapsed := time.Since(started)
			usage := observer.take()
			latencies[testCase.ID] = append(latencies[testCase.ID], elapsed)

			result := evaluationSample{
				Provider: provider,
				Model:    model,
				CaseID:   testCase.ID,
				Kind:     testCase.Kind,
				Sample:   sample + 1,
				Elapsed:  elapsed.Milliseconds(),
				Usage:    usage,
				Outcome:  outcome,
			}
			if evalErr != nil {
				result.Error = evalErr.Error()
				failures++
			}
			encoded, err := json.Marshal(result)
			if err != nil {
				t.Fatalf("encode evaluation sample: %v", err)
			}
			t.Logf("EVAL_SAMPLE %s", encoded)
		}
	}

	for _, testCase := range corpus.Cases {
		values := latencies[testCase.ID]
		summary := evaluationLatencySummary{
			Provider: provider,
			Model:    model,
			CaseID:   testCase.ID,
			Samples:  len(values),
			P50:      nearestRank(values, 0.50).Milliseconds(),
			P95:      nearestRank(values, 0.95).Milliseconds(),
		}
		encoded, err := json.Marshal(summary)
		if err != nil {
			t.Fatalf("encode latency summary: %v", err)
		}
		t.Logf("EVAL_LATENCY %s", encoded)
	}
	if failures > 0 {
		t.Fatalf("%d/%d measured scenario calls failed schema/domain/expected validation", failures, samples*len(corpus.Cases))
	}
}

type evaluationCorpus struct {
	Version int              `json:"version"`
	Cases   []evaluationCase `json:"cases"`
}

type evaluationCase struct {
	ID              string                    `json:"id"`
	Kind            string                    `json:"kind"`
	DiaryDate       string                    `json:"diary_date"`
	Body            string                    `json:"body"`
	Instruction     string                    `json:"instruction"`
	ExistingNeurons []existingNeuronFixture   `json:"existing_neurons"`
	Prior           *extractResultFixture     `json:"prior"`
	SemanticMemory  *semanticMemoryFixture    `json:"semantic_memory"`
	CurrentText     string                    `json:"current_text"`
	Rewrite         string                    `json:"rewrite"`
	ExpectedDiffers *bool                     `json:"expected_differs"`
	Summary         *memorySummaryFixture     `json:"summary"`
	Words           string                    `json:"words"`
	Candidates      []sealCandidateRefFixture `json:"candidates"`
	Review          []string                  `json:"review"`
}

type existingNeuronFixture struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type extractResultFixture struct {
	Memories []extractedMemoryFixture `json:"memories"`
}

type extractedMemoryFixture struct {
	Name       string                   `json:"name"`
	Mood       string                   `json:"mood"`
	SourceText string                   `json:"source_text"`
	Neurons    []extractedNeuronFixture `json:"neurons"`
}

type extractedNeuronFixture struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type semanticMemoryFixture struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	CurrentText string                   `json:"current_text"`
	Mood        string                   `json:"mood"`
	Neurons     []extractedNeuronFixture `json:"neurons"`
}

type memorySummaryFixture struct {
	Name        string `json:"name"`
	CurrentText string `json:"current_text"`
	Mood        string `json:"mood"`
}

type sealCandidateRefFixture struct {
	NeuronID string `json:"neuron_id"`
	Name     string `json:"name"`
}

type evaluationOutcome struct {
	SchemaDomainPass   bool  `json:"schema_domain_pass"`
	SourceFidelityPass *bool `json:"source_fidelity_pass,omitempty"`
	ExpectedPass       *bool `json:"expected_pass,omitempty"`
	Result             any   `json:"result,omitempty"`
}

type evaluationSample struct {
	Provider string            `json:"provider"`
	Model    string            `json:"model"`
	CaseID   string            `json:"case_id"`
	Kind     string            `json:"kind"`
	Sample   int               `json:"sample"`
	Elapsed  int64             `json:"elapsed_ms"`
	Usage    observedUsage     `json:"usage"`
	Outcome  evaluationOutcome `json:"outcome"`
	Error    string            `json:"error,omitempty"`
}

type evaluationLatencySummary struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	CaseID   string `json:"case_id"`
	Samples  int    `json:"samples"`
	P50      int64  `json:"p50_ms"`
	P95      int64  `json:"p95_ms"`
}

func loadEvaluationCorpus(t *testing.T) evaluationCorpus {
	t.Helper()
	raw, err := os.ReadFile("testdata/llm-evaluation-corpus.json")
	if err != nil {
		t.Fatalf("read evaluation corpus: %v", err)
	}
	var corpus evaluationCorpus
	if err := json.Unmarshal(raw, &corpus); err != nil {
		t.Fatalf("decode evaluation corpus: %v", err)
	}
	if corpus.Version <= 0 || len(corpus.Cases) == 0 {
		t.Fatal("evaluation corpus requires a positive version and at least one case")
	}
	return corpus
}

func evalCount(t *testing.T, key string, fallback int, allowZero bool) int {
	t.Helper()
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 || (!allowZero && value == 0) {
		t.Fatalf("%s=%q must be %s integer", key, raw, map[bool]string{true: "a non-negative", false: "a positive"}[allowZero])
	}
	return value
}

func evaluationContext(provider string, caseID string, phase string, sample int) context.Context {
	userID := fmt.Sprintf("eval-%s-%s-%s-%d", provider, caseID, phase, sample)
	return platform.ContextWithUserID(context.Background(), userID)
}

func evaluateCase(ctx context.Context, adapters ai.Adapters, testCase evaluationCase) (evaluationOutcome, error) {
	switch testCase.Kind {
	case "split":
		date, err := time.Parse(time.DateOnly, testCase.DiaryDate)
		if err != nil {
			return evaluationOutcome{}, fmt.Errorf("parse diary date: %w", err)
		}
		result, err := adapters.Extractor.Split(ctx, testCase.Body, date, existingNeurons(testCase.ExistingNeurons))
		return splitOutcome(testCase.Body, result, err)
	case "revise_split":
		if testCase.Prior == nil {
			return evaluationOutcome{}, fmt.Errorf("revise_split case requires prior")
		}
		result, err := adapters.Extractor.ReviseSplit(ctx, testCase.Body, extractResult(*testCase.Prior), testCase.Instruction)
		return splitOutcome(testCase.Body, result, err)
	case "semanticization":
		if testCase.SemanticMemory == nil {
			return evaluationOutcome{}, fmt.Errorf("semanticization case requires semantic_memory")
		}
		result, err := adapters.Semanticizer.GenerateSemanticStages(ctx, semanticMemory(*testCase.SemanticMemory))
		if err != nil {
			return evaluationOutcome{SchemaDomainPass: false}, err
		}
		return evaluationOutcome{SchemaDomainPass: true, Result: result}, nil
	case "prediction_error":
		result, err := adapters.PredictionError.Differs(ctx, testCase.CurrentText, testCase.Rewrite)
		if err != nil {
			return evaluationOutcome{SchemaDomainPass: false}, err
		}
		expectedPass := testCase.ExpectedDiffers == nil || result == *testCase.ExpectedDiffers
		outcome := evaluationOutcome{SchemaDomainPass: true, ExpectedPass: &expectedPass, Result: result}
		if !expectedPass {
			return outcome, fmt.Errorf("prediction result %t does not match expected %t", result, *testCase.ExpectedDiffers)
		}
		return outcome, nil
	case "seal_suggestion":
		if testCase.Summary == nil {
			return evaluationOutcome{}, fmt.Errorf("seal_suggestion case requires summary")
		}
		refs := sealCandidateRefs(testCase.Candidates)
		result, err := adapters.SealSuggester.Suggest(ctx, memorySummary(*testCase.Summary), testCase.Words, refs)
		if err != nil {
			return evaluationOutcome{SchemaDomainPass: false}, err
		}
		allowed := make(map[string]struct{}, len(refs))
		for _, ref := range refs {
			allowed[ref.NeuronID] = struct{}{}
		}
		for _, candidate := range result.Candidates {
			if _, ok := allowed[candidate.NeuronID]; !ok {
				return evaluationOutcome{SchemaDomainPass: false, Result: result},
					fmt.Errorf("seal suggestion returned unoffered id %q", candidate.NeuronID)
			}
		}
		return evaluationOutcome{SchemaDomainPass: true, Result: result}, nil
	default:
		return evaluationOutcome{}, fmt.Errorf("unknown evaluation kind %q", testCase.Kind)
	}
}

func splitOutcome(body string, result memory.ExtractResult, err error) (evaluationOutcome, error) {
	if err != nil {
		return evaluationOutcome{SchemaDomainPass: false}, err
	}
	sourcePass := true
	if _, violated := memory.SourceTextViolation(body, result.Memories); violated {
		sourcePass = false
	}
	domainPass := !memory.SplitNeedsRepair(body, result)
	outcome := evaluationOutcome{
		SchemaDomainPass:   domainPass,
		SourceFidelityPass: &sourcePass,
		Result:             result,
	}
	if !domainPass || !sourcePass {
		return outcome, fmt.Errorf("split failed domain or source-fidelity validation")
	}
	return outcome, nil
}

func existingNeurons(in []existingNeuronFixture) []memory.ExistingNeuron {
	out := make([]memory.ExistingNeuron, 0, len(in))
	for _, value := range in {
		out = append(out, memory.ExistingNeuron{ID: value.ID, Name: value.Name, Type: memory.NeuronType(value.Type)})
	}
	return out
}

func extractResult(in extractResultFixture) memory.ExtractResult {
	out := memory.ExtractResult{Memories: make([]memory.ExtractedMemory, 0, len(in.Memories))}
	for _, value := range in.Memories {
		out.Memories = append(out.Memories, memory.ExtractedMemory{
			Name: value.Name, Mood: memory.Mood(value.Mood), SourceText: value.SourceText, Neurons: extractedNeurons(value.Neurons),
		})
	}
	return out
}

func extractedNeurons(in []extractedNeuronFixture) []memory.ExtractedNeuron {
	out := make([]memory.ExtractedNeuron, 0, len(in))
	for _, value := range in {
		out = append(out, memory.ExtractedNeuron{Name: value.Name, Type: memory.NeuronType(value.Type)})
	}
	return out
}

func semanticMemory(in semanticMemoryFixture) memory.SemanticizeMemory {
	return memory.SemanticizeMemory{
		ID: in.ID, Name: in.Name, CurrentText: in.CurrentText, Mood: memory.Mood(in.Mood), Neurons: extractedNeurons(in.Neurons),
	}
}

func memorySummary(in memorySummaryFixture) memory.MemorySummary {
	return memory.MemorySummary{Name: in.Name, CurrentText: in.CurrentText, Mood: memory.Mood(in.Mood)}
}

func sealCandidateRefs(in []sealCandidateRefFixture) []memory.SealCandidateRef {
	out := make([]memory.SealCandidateRef, 0, len(in))
	for _, value := range in {
		out = append(out, memory.SealCandidateRef{NeuronID: value.NeuronID, Name: value.Name})
	}
	return out
}

type observedUsage struct {
	InputTokens  int64    `json:"input_tokens,omitempty"`
	OutputTokens int64    `json:"output_tokens,omitempty"`
	Cost         *float64 `json:"reported_cost,omitempty"`
}

type usageObserverTransport struct {
	base http.RoundTripper
	mu   sync.Mutex
	last observedUsage
}

func (o *usageObserverTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := o.base.RoundTrip(req)
	if err != nil || resp == nil || resp.Body == nil {
		return resp, err
	}
	raw, readErr := io.ReadAll(io.LimitReader(resp.Body, maxObservedResponseBytes+1))
	_ = resp.Body.Close()
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	if readErr == nil && len(raw) <= maxObservedResponseBytes {
		o.mu.Lock()
		o.last = parseObservedUsage(raw)
		o.mu.Unlock()
	}
	return resp, nil
}

func (o *usageObserverTransport) take() observedUsage {
	o.mu.Lock()
	defer o.mu.Unlock()
	value := o.last
	o.last = observedUsage{}
	return value
}

func parseObservedUsage(raw []byte) observedUsage {
	var envelope struct {
		Usage struct {
			PromptTokens     int64    `json:"prompt_tokens"`
			CompletionTokens int64    `json:"completion_tokens"`
			InputTokens      int64    `json:"input_tokens"`
			OutputTokens     int64    `json:"output_tokens"`
			Cost             *float64 `json:"cost"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return observedUsage{}
	}
	input := envelope.Usage.InputTokens
	if input == 0 {
		input = envelope.Usage.PromptTokens
	}
	output := envelope.Usage.OutputTokens
	if output == 0 {
		output = envelope.Usage.CompletionTokens
	}
	return observedUsage{InputTokens: input, OutputTokens: output, Cost: envelope.Usage.Cost}
}

func nearestRank(values []time.Duration, percentile float64) time.Duration {
	if len(values) == 0 {
		return 0
	}
	sorted := append([]time.Duration(nil), values...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	index := int(math.Ceil(percentile*float64(len(sorted)))) - 1
	if index < 0 {
		index = 0
	}
	return sorted[index]
}
