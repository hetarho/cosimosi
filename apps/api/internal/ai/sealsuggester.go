package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/cosimosi/api/internal/memory"
)

// RealSealSuggester is the letting-go seal-suggester's LLM adapter ([X6]): given a memory, the user's
// words, and a pre-filtered this-memory-only semantic-neuron candidate set, it returns a schema-forced
// ranking/selection of candidate references with a short human reason. It owns task knowledge only — the
// prompt and the output schema; metering, caching, and the per-call cap live in the wrapped client
// (§2.4). The output is STRUCTURALLY unable to emit a delete/seal command or a shared/foreign
// reference: the schema has only {neuron_id, reason}, and neuron_id is constrained to the offered
// candidate ids (an enum), so the model can rank within the safe set but never widen it — the structural
// half of "the AI only suggests, the domain executes".
type RealSealSuggester struct {
	client LLMClient
}

func NewRealSealSuggester(client LLMClient) (*RealSealSuggester, error) {
	if client == nil {
		return nil, ErrLLMClientRequired
	}
	return &RealSealSuggester{client: client}, nil
}

func (a *RealSealSuggester) Suggest(ctx context.Context, summary memory.MemorySummary, words string, candidates []memory.SealCandidateRef) (memory.SealSuggestion, error) {
	// No candidate meanings to rank — nothing to ask the model, so no billable call is made.
	if len(candidates) == 0 {
		return memory.SealSuggestion{}, nil
	}
	candidateIDs := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		candidateIDs = append(candidateIDs, candidate.NeuronID)
	}
	resp, err := a.client.CompleteJSON(ctx, LLMRequest{
		Prompt:       sealSuggesterPrompt(summary, words, candidates),
		OutputSchema: SealSuggesterOutputSchema(candidateIDs),
		CacheKey:     stableHash("seal-suggester", summary.Name, summary.CurrentText, string(summary.Mood), words, candidates),
		Validate:     func(body []byte) error { _, err := parseSealSuggestion(body); return err },
	})
	if err != nil {
		return memory.SealSuggestion{}, err
	}
	return parseSealSuggestion(resp.JSON)
}

type sealSuggestionJSON struct {
	Candidates []struct {
		NeuronID string `json:"neuron_id"`
		Reason   string `json:"reason"`
	} `json:"candidates"`
}

func parseSealSuggestion(raw []byte) (memory.SealSuggestion, error) {
	var envelope sealSuggestionJSON
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return memory.SealSuggestion{}, err
	}
	candidates := make([]memory.SealCandidate, 0, len(envelope.Candidates))
	for _, candidate := range envelope.Candidates {
		if candidate.NeuronID == "" {
			return memory.SealSuggestion{}, errors.New("seal suggestion candidate missing neuron_id")
		}
		// Name is left to the use-case (authoritative from the offered set) — the model has no field
		// in which to invent one.
		candidates = append(candidates, memory.SealCandidate{NeuronID: candidate.NeuronID, Reason: candidate.Reason})
	}
	return memory.SealSuggestion{Candidates: candidates}, nil
}

// SealSuggesterOutputSchema forces the output to references of the offered candidate ids only: neuron_id
// is an enum over the offered set, and there is no field for a command or any other reference ([X6]).
func SealSuggesterOutputSchema(candidateIDs []string) JSONSchema {
	return JSONSchema{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"candidates"},
		"properties": map[string]any{
			"candidates": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"neuron_id", "reason"},
					"properties": map[string]any{
						"neuron_id": map[string]any{"type": "string", "enum": candidateIDs},
						"reason":    map[string]any{"type": "string"},
					},
				},
			},
		},
	}
}

func sealSuggesterPrompt(summary memory.MemorySummary, words string, candidates []memory.SealCandidateRef) string {
	var list strings.Builder
	for _, candidate := range candidates {
		fmt.Fprintf(&list, "\n- id=%s name=%q", candidate.NeuronID, candidate.Name)
	}
	return fmt.Sprintf(
		"A person wants to let go of a specific meaning tied to a memory — not delete the memory, only "+
			"release the meanings they name. From the candidate meanings below (each a concept this memory "+
			"alone holds), select the ones the person's words are asking to release, and for each give one "+
			"short, plain sentence of why it matches. Reference ONLY the given candidate ids; never invent an "+
			"id. Return only JSON matching the provided schema. The memory name: %q. Its text: %q. Mood: %s. "+
			"The person's words: %q. Candidate meanings:%s",
		summary.Name, summary.CurrentText, summary.Mood, words, list.String(),
	)
}

// Static assertions: both adapters satisfy the consumer-owned seal-suggester port.
var (
	_ memory.SealSuggester = (*RealSealSuggester)(nil)
	_ memory.SealSuggester = MockSealSuggester{}
)
