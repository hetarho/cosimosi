package memory

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
	// ErrEncodeRetryExhausted is the canonical give-up error [W4a]: the repair budget
	// (encode.max_revise_retries) ran out before the extractor met the invariants. It is a
	// failure of the sample, not of any allowance — see EncodeRetryExhausted for the kind.
	ErrEncodeRetryExhausted = errors.New("memory encode retry budget exhausted")
	// ErrEncodeInvalidSplit marks a structurally broken extractor result (unknown
	// mood/type, blank name). Unlike a repairable violation this is an adapter
	// contract breach — re-prompting cannot fix a port that ignores the schema.
	ErrEncodeInvalidSplit = errors.New("memory encode received an invalid split")
	// ErrEncodeBodyTooLong is the canonical over-budget error for the diary itself.
	// Since each memory carries its own passage, the split response holds the diary
	// redistributed across the memories, so a body long enough to crowd out the
	// structure around it can never fit encode.max_output_tokens however terse the
	// model is — a shorter split would break coverage. The writer is told before a
	// single LLM call, instead of after the repair budget burns down on a violation
	// no re-prompt can fix. Verbosity the model CAN take back (long names, surplus
	// neurons) is not priced here; that is ViolationOutputTooLarge's job.
	ErrEncodeBodyTooLong = errors.New("memory encode diary body exceeds the output budget")
	// ErrScopeRequired guards every use-case entry point (§4 per-user isolation).
	ErrScopeRequired = errors.New("memory use-case requires an authenticated user scope")
)

// ViolationKind names WHICH encode invariant a sample missed. It is a closed set because it is the
// only half of a violation allowed to leave the process: the instruction beside it is written for
// the model and quotes the proposed memory name and a passage token, which the error contract
// forbids sending to a client or a reporter (policy/platform/errors.md §1). The kind plus a count
// is enough to tell an operator which rule gave up without ever handling the writer's words.
type ViolationKind string

const (
	ViolationCountUnder            ViolationKind = "count_under"
	ViolationCountOver             ViolationKind = "count_over"
	ViolationSemanticNeuronMissing ViolationKind = "semantic_neuron_missing"
	ViolationSourceTextNovelToken  ViolationKind = "source_text_novel_token"
	ViolationSourceTextReworded    ViolationKind = "source_text_reworded"
	ViolationSourceTextCoverage    ViolationKind = "source_text_coverage"
	ViolationOutputTooLarge        ViolationKind = "output_too_large"
)

// Violation is one repairable miss: the reportable kind, the re-prompt instruction that may only be
// shown to the model, and — for the count kinds — how many memories the extractor actually returned.
type Violation struct {
	Kind        ViolationKind
	Instruction string
	MemoryCount int
}

// EncodeRetryExhausted is the give-up carrying the kind that defeated the loop, mirroring
// twinkle's InsufficientTwinkle: it wraps the canonical sentinel so every
// errors.Is(err, ErrEncodeRetryExhausted) site keeps working, and its Detail is the one channel
// through which the failure reaches a client — content-free by construction.
type EncodeRetryExhausted struct {
	Kind        ViolationKind
	MemoryCount int
}

func (e *EncodeRetryExhausted) Error() string {
	if e.MemoryCount > 0 {
		return fmt.Sprintf("%s: %s (memories=%d)", ErrEncodeRetryExhausted.Error(), e.Kind, e.MemoryCount)
	}
	return fmt.Sprintf("%s: %s", ErrEncodeRetryExhausted.Error(), e.Kind)
}

func (e *EncodeRetryExhausted) Unwrap() error { return ErrEncodeRetryExhausted }

// Detail is the give-up as the apperr metadata channel carries it: non-content discriminators only.
func (e *EncodeRetryExhausted) Detail() map[string]string {
	detail := map[string]string{"violation_kind": string(e.Kind)}
	if e.MemoryCount > 0 {
		detail["memories"] = strconv.Itoa(e.MemoryCount)
	}
	return detail
}

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
	if err := bodyWithinOutputBudget(body); err != nil {
		return ExtractResult{}, err
	}
	candidates, err := s.dedupCandidates(ctx, scope, body)
	if err != nil {
		return ExtractResult{}, err
	}
	result, err := s.extractor.Split(ctx, body, diaryDate, candidates)
	if err != nil {
		return ExtractResult{}, err
	}
	return s.repairUntilValid(ctx, body, result)
}

// ReviseSplit re-runs the split from a natural-language instruction + the prior
// result [W4a], against the same schema-forced output and the same invariants.
func (s *Service) ReviseSplit(ctx context.Context, scope platform.UserScope, body string, previous ExtractResult, instruction string) (ExtractResult, error) {
	if scope.UserID() == "" {
		return ExtractResult{}, ErrScopeRequired
	}
	body = strings.TrimSpace(body)
	instruction = strings.TrimSpace(instruction)
	if body == "" || instruction == "" || len(previous.Memories) == 0 {
		return ExtractResult{}, ErrEncodeInputRequired
	}
	if err := bodyWithinOutputBudget(body); err != nil {
		return ExtractResult{}, err
	}
	// The prior result arrives from the client; a hand-crafted request must not
	// smuggle an invalid shape past the domain just because the LLM never saw it.
	if err := validateSplitStructure(previous); err != nil {
		return ExtractResult{}, fmt.Errorf("%w: previous result: %v", ErrEncodeInputRequired, err)
	}
	result, err := s.extractor.ReviseSplit(ctx, body, previous, instruction)
	if err != nil {
		return ExtractResult{}, err
	}
	return s.repairUntilValid(ctx, body, result)
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
	// The embedding kNN is a best-effort assist by design (a "narrow assist"):
	// a throttled embedder or an over-long body must not take down the
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

// repairUntilValid enforces the encode invariants on an extractor result. A repairable violation
// (count over the target [E2], missing semantic neuron [E4], passages that are not the writer's
// words, output over budget) re-prompts through the revise variant — never a silent clamp, never a
// placeholder neuron — bounded by encode.max_revise_retries.
//
// A count BELOW the target is the one soft violation: the target is 2–5 scenes ([E2] reads "보통
// 2~5개"), but a day that held one continuous event is one scene, and rule 1 of the prompt forbids
// splitting it further. So an under-count is nudged encode.under_count_nudges times and then
// accepted as the writer's day. Acceptance covers the count alone — every other invariant still has
// to hold on the accepted result, with the WHOLE repair budget to get there: the nudge has its own
// counter, so a single-scene diary is not left fewer attempts than a two-scene one.
func (s *Service) repairUntilValid(ctx context.Context, body string, result ExtractResult) (ExtractResult, error) {
	attempt, nudges, countUnderAccepted := 0, 0, false
	for {
		if err := validateSplitStructure(result); err != nil {
			return ExtractResult{}, err
		}
		violation, ok := repairableViolation(body, result, countUnderAccepted)
		if !ok {
			return result, nil
		}
		// The nudge draws on its own budget, not the repair budget. Sharing one counter would leave a
		// single-scene diary fewer attempts to fix a passage than a two-scene one — the same
		// punishment for a legitimate day that this whole rule exists to remove. A count below the
		// accepted floor is not a nudge at all: there is no split to show, so it repairs like any
		// hard violation and can never spend the nudge budget in a loop.
		softNudge := violation.Kind == ViolationCountUnder &&
			violation.MemoryCount >= values.EncodeMinMemoriesAccepted
		if softNudge && nudges >= values.EncodeUnderCountNudges {
			// The extractor was asked and stood by its reading. Suppressing the check (rather than
			// returning here) is what keeps the other invariants enforced on the accepted split.
			countUnderAccepted = true
			continue
		}
		if !softNudge && attempt >= values.EncodeMaxReviseRetries {
			return ExtractResult{}, &EncodeRetryExhausted{Kind: violation.Kind, MemoryCount: violation.MemoryCount}
		}
		next, err := s.extractor.ReviseSplit(ctx, body, result, violation.Instruction)
		if err != nil {
			return ExtractResult{}, err
		}
		result = next
		if softNudge {
			nudges++
		} else {
			attempt++
		}
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
		if strings.TrimSpace(proposed.SourceText) == "" {
			return fmt.Errorf("%w: memory %q requires a source text", ErrEncodeInvalidSplit, proposed.Name)
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

// repairableViolation returns the first invariant the result misses, or ok=false when the result is
// acceptable. countUnderAccepted suppresses the below-target count check — once the extractor has
// declined the nudge, the count is the writer's day and only the other invariants are worth
// repairing. A count below encode.min_memories_accepted is reported either way: below the floor
// there is no split to show the writer at all.
func repairableViolation(body string, result ExtractResult, countUnderAccepted bool) (Violation, bool) {
	count := len(result.Memories)
	switch {
	case count > values.EncodeMaxMemories:
		return Violation{Kind: ViolationCountOver, MemoryCount: count, Instruction: fmt.Sprintf(
			"You returned %d memories; return at most %d. Merge the ones that belong to a single event (same place, "+
				"people, activity and topic) into one memory, keeping their passages consecutive — never split on an "+
				"emotion shift.",
			count, values.EncodeMaxMemories,
		)}, true
	case count < values.EncodeMinMemoriesAccepted || (count < values.EncodeMinMemories && !countUnderAccepted):
		return Violation{Kind: ViolationCountUnder, MemoryCount: count, Instruction: fmt.Sprintf(
			"You returned %d memories, fewer than the usual %d to %d. Look again for an event boundary you passed "+
				"over — a change of place, people, activity or topic. If the diary truly describes one continuous "+
				"event, keep it as one memory: never split on an emotion shift to reach a number.",
			count, values.EncodeMinMemories, values.EncodeMaxMemories,
		)}, true
	}
	for _, proposed := range result.Memories {
		if !hasRequiredSemanticNeurons(proposed) {
			return Violation{Kind: ViolationSemanticNeuronMissing, Instruction: fmt.Sprintf(
				"Every memory must carry at least %d semantic neuron(s) extracted from the diary itself — do not invent filler concepts.",
				values.EncodeMinSemanticNeurons,
			)}, true
		}
	}
	if violation, ok := SourceTextViolation(body, result.Memories); ok {
		return violation, true
	}
	// Last, and only for what the model can still fix: the passages are already pinned to the
	// diary (bodyWithinOutputBudget cleared it before the call), so any remaining excess is the
	// names and neurons around them. Asking for a smaller result would otherwise be asking the
	// model to break the coverage rule it was just held to.
	if estimateOutputTokens(result) > values.EncodeMaxOutputTokens {
		return Violation{Kind: ViolationOutputTooLarge, Instruction: "The result is too large. Use shorter memory names and keep only the essential neurons."}, true
	}
	return Violation{}, false
}

// SplitNeedsRepair reports whether a fresh extractor sample still misses an invariant the repair
// loop would re-prompt for. It is how the extractor adapter asks the domain whether a sample is
// worth keeping: one on its way back into the repair loop must not be replayed to the next
// identical call from a cache. The rule stays here — the adapter asks, it never re-implements it.
//
// A below-target count answers yes even though the loop may end up accepting it: the acceptance is a
// decision about one call's outcome, not about the sample, and the next press deserves a fresh draw
// rather than the reading the model was already nudged on.
func SplitNeedsRepair(body string, result ExtractResult) bool {
	_, needsRepair := repairableViolation(body, result, false)
	return needsRepair
}

// bodyWithinOutputBudget refuses a diary that cannot fit encode.max_output_tokens even as the
// cheapest split the domain would accept. It is checked on the way IN, before any LLM call: the
// split must quote the whole diary back ([E1]), so an over-long body is not something a re-prompt
// can repair — the repair budget would burn down ping-ponging between "too large" and "you dropped
// a scene".
//
// The estimate has to include the split's own structure, not just the passages. Measuring the body
// alone admits diaries for which NO legal split fits: every memory carries a name, a mood and at
// least one neuron, so a body inside the budget by less than that scaffolding costs is refused only
// after the repair budget is spent, with the give-up error instead of this one — the exact outcome
// this guard exists to prevent.
func bodyWithinOutputBudget(body string) error {
	estimate := estimateOutputTokens(minimumAdmissibleSplit(body))
	if estimate > values.EncodeMaxOutputTokens {
		return fmt.Errorf("%w: %d estimated tokens over the %d budget",
			ErrEncodeBodyTooLong, estimate, values.EncodeMaxOutputTokens)
	}
	return nil
}

// minimumAdmissibleSplit is the CHEAPEST result the domain would accept for this body, used to price
// the structure a split cannot avoid carrying.
//
// Cheapest, not typical, and the split is worst-cased only where the writer has no say. The memory
// count is encode.max_memories: a five-scene day is admissible and nobody can choose otherwise, so
// reserving for fewer would let the guard admit a body that a legal split then overflows. Mood and
// neuron type are worst-cased over their closed enums for the same reason. Names are taken at their
// smallest legal size instead, because name and neuron verbosity is precisely what the
// ViolationOutputTooLarge re-prompt can still fix — pricing it here would refuse diaries that a
// terser split fits.
//
// How the body is distributed across the memories does not matter: the estimate counts the passage
// characters once wherever they sit, and the source texts jointly quote the diary ([E1]).
func minimumAdmissibleSplit(body string) ExtractResult {
	// Every memory carries a non-empty passage (validateSplitStructure), and the passages jointly
	// quote the diary ([E1]) — so the body is DISTRIBUTED, not duplicated. Total passage cost is the
	// body's either way; what the distribution buys is a result that is actually admissible, which is
	// what makes the reservation a bound rather than a guess.
	runes := []rune(body)
	count := values.EncodeMaxMemories
	if len(runes) < count {
		// A diary with fewer runes than the maximum scene count cannot be split that far. Such a body
		// is nowhere near the budget, so pricing it against a count it can never reach would only
		// invent a ceiling.
		count = len(runes)
	}
	if count < 1 {
		count = 1
	}
	memories := make([]ExtractedMemory, 0, count)
	for i := 0; i < count; i++ {
		start := len(runes) * i / count
		end := len(runes) * (i + 1) / count
		memory := ExtractedMemory{
			Name:       minimumName,
			Mood:       longestMood(),
			SourceText: string(runes[start:end]),
		}
		for n := 0; n < values.EncodeMinSemanticNeurons; n++ {
			memory.Neurons = append(memory.Neurons, ExtractedNeuron{Name: minimumName, Type: longestNeuronType()})
		}
		memories = append(memories, memory)
	}
	return ExtractResult{Memories: memories}
}

// The shortest name the structure check accepts, priced as one non-ASCII token — the floor a split
// cannot go below, while anything longer is the model's to take back on a re-prompt.
const minimumName = "가"

// The enum members whose spelling costs the most, so the reservation cannot be undone by the model
// picking a longer mood or type than the one we priced. Derived from the catalogues rather than
// spelled out, so adding a mood or a neuron type re-prices the guard instead of silently loosening it.
func longestMood() Mood {
	longest := Mood("")
	for _, mood := range AllMoods() {
		if len(mood) > len(longest) {
			longest = mood
		}
	}
	return longest
}

func longestNeuronType() NeuronType {
	longest := NeuronType("")
	for _, neuronType := range AllNeuronTypes() {
		if len(neuronType) > len(longest) {
			longest = neuronType
		}
	}
	return longest
}

// memoryCountAccepted and hasRequiredSemanticNeurons are the single owners of the [E2]/[E4]
// predicates — the preview repair loop and the launch validator must enforce the same rule, never
// two drifting copies.
//
// Accepted is not the same as on target: 2–5 ([E2]'s "보통 2~5개") is what the prompt asks for and
// what the loop nudges toward, while this is what the product admits — one scene for a day that
// held one. A launch may only refuse what the preview could never have produced.
func memoryCountAccepted(count int) bool {
	return count >= values.EncodeMinMemoriesAccepted && count <= values.EncodeMaxMemories
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
		ascii += len(`{"name":"","mood":"","source_text":"","neurons":[]},`) + len(proposed.Mood)
		asciiPart, runeTokens := splitCharCounts(proposed.Name)
		ascii, tokens = ascii+asciiPart, tokens+runeTokens
		// The source texts quote the whole diary between them, so they dominate this
		// estimate — the budget is sized for a diary, not for a list of names.
		asciiPart, runeTokens = splitCharCounts(proposed.SourceText)
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
