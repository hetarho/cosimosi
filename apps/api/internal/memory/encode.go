package memory

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

var (
	// ErrEncodeInputRequired is the canonical invalid-input error for the encode
	// previews (empty body, missing date, missing instruction/previous on revise).
	ErrEncodeInputRequired = errors.New("memory encode requires a body and a diary date")
	// ErrEncodeRetryExhausted is the canonical cap error [W4a]: the repair budget
	// (encode.max_revise_retries) ran out before the extractor met the invariants.
	ErrEncodeRetryExhausted = errors.New("memory encode retry budget exhausted")
	// ErrEncodeInvalidSplit marks a structurally broken extractor result (unknown
	// mood/type, blank name). Unlike a repairable violation this is an adapter
	// contract breach — re-prompting cannot fix a port that ignores the schema.
	ErrEncodeInvalidSplit = errors.New("memory encode received an invalid split")
	// ErrScopeRequired guards every use-case entry point (§4 per-user isolation).
	ErrScopeRequired = errors.New("memory use-case requires an authenticated user scope")
)

// Encode produces the proposed split behind SplitDiary [W2]: assemble the per-user
// dedup-candidate set, call the schema-forced extractor, and enforce the domain
// invariants with repair re-prompts. It persists nothing and computes no
// coordinate, color, strength, or seed.
func (s *Service) Encode(ctx context.Context, scope platform.UserScope, body string, diaryDate time.Time) (ExtractResult, error) {
	if scope.UserID() == "" {
		return ExtractResult{}, ErrScopeRequired
	}
	body = strings.TrimSpace(body)
	if body == "" || diaryDate.IsZero() {
		return ExtractResult{}, ErrEncodeInputRequired
	}
	candidates, err := s.dedupCandidates(ctx, scope, body)
	if err != nil {
		return ExtractResult{}, err
	}
	result, err := s.extractor.Split(ctx, body, diaryDate, candidates)
	if err != nil {
		return ExtractResult{}, err
	}
	return s.repairUntilValid(ctx, result)
}

// ReviseSplit re-runs the split from a natural-language instruction + the prior
// result [W4a], against the same schema-forced output and the same invariants.
func (s *Service) ReviseSplit(ctx context.Context, scope platform.UserScope, previous ExtractResult, instruction string) (ExtractResult, error) {
	if scope.UserID() == "" {
		return ExtractResult{}, ErrScopeRequired
	}
	instruction = strings.TrimSpace(instruction)
	if instruction == "" || len(previous.Memories) == 0 {
		return ExtractResult{}, ErrEncodeInputRequired
	}
	// The prior result arrives from the client; a hand-crafted request must not
	// smuggle an invalid shape past the domain just because the LLM never saw it.
	if err := validateSplitStructure(previous); err != nil {
		return ExtractResult{}, fmt.Errorf("%w: previous result: %v", ErrEncodeInputRequired, err)
	}
	result, err := s.extractor.ReviseSplit(ctx, previous, instruction)
	if err != nil {
		return ExtractResult{}, err
	}
	return s.repairUntilValid(ctx, result)
}

// dedupCandidates assembles the candidate set for the extractor's conservative
// canonicalization ([E10]): neurons whose name appears in the diary body, plus the
// narrow embedding nearest-neighbour assist over the body's vector. It is a
// candidate list, never a merge decision.
func (s *Service) dedupCandidates(ctx context.Context, scope platform.UserScope, body string) ([]ExistingNeuron, error) {
	inBody, err := s.candidates.ListNeuronCandidatesInBody(ctx, scope, body, values.EncodeDedupBodyMatchLimit)
	if err != nil {
		return nil, err
	}
	// The embedding kNN is a best-effort assist by design (a "narrow assist",
	// plan 20): a throttled embedder or an over-long body must not take down the
	// whole preview — candidates degrade to the name-match set.
	var nearest []ExistingNeuron
	if vectors, err := s.embedder.Embed(ctx, []string{body}); err == nil && len(vectors) == 1 {
		nearest, _ = s.candidates.ListNearestNeuronCandidates(
			ctx,
			scope,
			vectors[0],
			values.EncodeDedupSimilarityThreshold,
			values.EncodeDedupTopK,
		)
	}
	seen := make(map[string]struct{}, len(inBody)+len(nearest))
	merged := make([]ExistingNeuron, 0, len(inBody)+len(nearest))
	for _, neuron := range append(inBody, nearest...) {
		if _, ok := seen[neuron.ID]; ok {
			continue
		}
		seen[neuron.ID] = struct{}{}
		merged = append(merged, neuron)
	}
	return merged, nil
}

// repairUntilValid enforces the encode invariants on an extractor result. A
// repairable violation (count out of range [E2], missing semantic neuron [E4],
// output over budget) re-prompts through the revise variant — never a silent
// clamp, never a placeholder neuron — bounded by encode.max_revise_retries.
func (s *Service) repairUntilValid(ctx context.Context, result ExtractResult) (ExtractResult, error) {
	for attempt := 0; ; attempt++ {
		if err := validateSplitStructure(result); err != nil {
			return ExtractResult{}, err
		}
		violation := repairableViolation(result)
		if violation == "" {
			return result, nil
		}
		if attempt >= values.EncodeMaxReviseRetries {
			return ExtractResult{}, fmt.Errorf("%w: %s", ErrEncodeRetryExhausted, violation)
		}
		next, err := s.extractor.ReviseSplit(ctx, result, violation)
		if err != nil {
			return ExtractResult{}, err
		}
		result = next
	}
}

// validateSplitStructure rejects shapes the schema-forced output can never carry:
// blank names, moods outside the 13-mood enum [M1], neuron types outside
// {semantic, spatial, entity} [E3]. Time can never appear as a neuron [E6] — the
// domain shape has no field for it and no "time" type exists.
func validateSplitStructure(result ExtractResult) error {
	for _, proposed := range result.Memories {
		if strings.TrimSpace(proposed.Name) == "" {
			return fmt.Errorf("%w: memory requires a name", ErrEncodeInvalidSplit)
		}
		if _, ok := MoodCoordinate(proposed.Mood); !ok {
			return fmt.Errorf("%w: mood %q is not in the 13-mood enum", ErrEncodeInvalidSplit, proposed.Mood)
		}
		for _, neuron := range proposed.Neurons {
			if strings.TrimSpace(neuron.Name) == "" {
				return fmt.Errorf("%w: neuron requires a name", ErrEncodeInvalidSplit)
			}
			if !neuron.Type.Valid() {
				return fmt.Errorf("%w: neuron type %q is not supported", ErrEncodeInvalidSplit, neuron.Type)
			}
		}
	}
	return nil
}

// repairableViolation returns the re-prompt instruction for the first invariant
// the result misses, or "" when the result is acceptable.
func repairableViolation(result ExtractResult) string {
	if !memoryCountInRange(len(result.Memories)) {
		return fmt.Sprintf(
			"Return between %d and %d memories, split on event boundaries (place, person, activity, or topic shifts) — never on emotion shifts.",
			values.EncodeMinMemories,
			values.EncodeMaxMemories,
		)
	}
	for _, proposed := range result.Memories {
		if !hasRequiredSemanticNeurons(proposed) {
			return fmt.Sprintf(
				"Every memory must carry at least %d semantic neuron(s) extracted from the diary itself — do not invent filler concepts.",
				values.EncodeMinSemanticNeurons,
			)
		}
	}
	if estimateOutputTokens(result) > values.EncodeMaxOutputTokens {
		return "The result is too large. Use shorter memory names and keep only the essential neurons."
	}
	return ""
}

// memoryCountInRange and hasRequiredSemanticNeurons are the single owners of the
// [E2]/[E4] predicates — the preview repair loop and the launch validator must
// enforce the same rule, never two drifting copies.
func memoryCountInRange(count int) bool {
	return count >= values.EncodeMinMemories && count <= values.EncodeMaxMemories
}

func hasRequiredSemanticNeurons(proposed ExtractedMemory) bool {
	semantic := 0
	for _, neuron := range proposed.Neurons {
		if neuron.Type == NeuronTypeSemantic {
			semantic++
		}
	}
	return semantic >= values.EncodeMinSemanticNeurons
}

// estimateOutputTokens approximates the schema-forced response size for the
// encode.max_output_tokens guard. The Extractor port intentionally hides provider
// token accounting, so the budget is checked against the JSON-shaped size of the
// domain result: ASCII at the usual ~4 chars/token, other scripts (Korean diaries)
// conservatively at one token per rune.
func estimateOutputTokens(result ExtractResult) int {
	const asciiCharsPerToken = 4
	tokens := 0
	ascii := len(`{"memories":[]}`)
	for _, proposed := range result.Memories {
		ascii += len(`{"name":"","mood":"","neurons":[]},`) + len(proposed.Mood)
		asciiPart, runeTokens := splitCharCounts(proposed.Name)
		ascii, tokens = ascii+asciiPart, tokens+runeTokens
		for _, neuron := range proposed.Neurons {
			ascii += len(`{"name":"","type":""},`) + len(neuron.Type)
			asciiPart, runeTokens = splitCharCounts(neuron.Name)
			ascii, tokens = ascii+asciiPart, tokens+runeTokens
		}
	}
	return tokens + (ascii+asciiCharsPerToken-1)/asciiCharsPerToken
}

func splitCharCounts(text string) (asciiChars int, nonASCIITokens int) {
	for _, r := range text {
		if r < utf8.RuneSelf {
			asciiChars++
		} else {
			nonASCIITokens++
		}
	}
	return asciiChars, nonASCIITokens
}
