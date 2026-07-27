package memory

import (
	"fmt"
	"math"
	"strings"
	"unicode"

	"github.com/cosimosi/api/internal/platform/values"
)

// A source text is the passage of the diary one episodic memory was encoded from, kept in the
// writer's own words: the extractor may repair a typo and the ending left dangling where the
// passage was cut, but never substitute a word, paraphrase, or invent a sentence.
//
// The output schema cannot express that rule — free text is free text — so the domain verifies
// it against the diary instead of trusting the prompt. This is the structural half of the [W4a]
// defense applied to the one encode field that carries prose: the writer's own account is the
// thing at risk, and only a comparison against the diary can protect it.
//
// The check constrains the EXTRACTOR, not the writer. It runs in the Encode/ReviseSplit repair
// loop, where every passage is model output; PersistEncoded deliberately does not re-run it,
// because a passage arriving there may be the writer's own edit ([W4]).

// sourceTextRepairMinSharedPrefixRunes is the one structural rule that separates a repair from a
// substitution, and it is not tuning: a typo fix and an ending change both preserve the head of
// the word ("디뎠고" → "디뎠다"), while a substituted word starts somewhere else entirely
// ("더웠다" → "뜨거웠다"). Without it, edit distance alone would admit short synonyms.
const sourceTextRepairMinSharedPrefixRunes = 1

// SourceTextViolation reports the first way an extractor's passages fail to be the writer's own
// words, phrased as the re-prompt instruction the repair loop sends back, or "" when they hold.
// Pure: no IO, no clock, no LLM.
func SourceTextViolation(body string, memories []ExtractedMemory) string {
	bodyTokens := sourceTextTokens(body)
	if len(bodyTokens) == 0 {
		return ""
	}
	// Occurrence counts, not a set: a diary that says "오늘" three times is only covered by
	// three passage mentions, so dropping two of the three scenes cannot read as covered.
	remaining := make(map[string]int, len(bodyTokens))
	for _, token := range bodyTokens {
		remaining[token]++
	}
	distinct := make([]string, 0, len(remaining))
	for token := range remaining {
		distinct = append(distinct, token)
	}

	covered := 0
	for _, proposed := range memories {
		passage := sourceTextTokens(proposed.SourceText)
		budget := repairBudget(len(passage))
		repaired := 0
		for _, token := range passage {
			match, exact := traceToDiary(token, remaining, distinct)
			if match == "" {
				return fmt.Sprintf(
					"The source_text for %q contains %q, which is not in the diary. Every source_text must be the "+
						"writer's own words — you may fix a typo and repair the ending where you cut the passage, "+
						"but never replace a word, rephrase a sentence, or add one.",
					proposed.Name, token,
				)
			}
			if !exact {
				repaired++
				if repaired > budget {
					return fmt.Sprintf(
						"The source_text for %q rewords the diary in %d places; at most %d may differ. Quote the "+
							"writer's sentences as they are — repair only typos and the ending at the cut.",
						proposed.Name, repaired, budget,
					)
				}
			}
			if remaining[match] > 0 {
				remaining[match]--
				covered++
			}
		}
	}

	if float64(covered) < values.EncodeSourceTextMinCoverage*float64(len(bodyTokens)) {
		return fmt.Sprintf(
			"The source_texts together cover only %d of the diary's %d words. Every part of the diary belongs to "+
				"one of the memories — split it into consecutive passages that leave nothing out and do not overlap.",
			covered, len(bodyTokens),
		)
	}
	return ""
}

// BlankSourceText reports whether any memory arrived without a passage. Unlike the fidelity
// rule this is a schema breach, not a judgement the model can be re-prompted out of.
func BlankSourceText(memories []ExtractedMemory) bool {
	for _, proposed := range memories {
		if strings.TrimSpace(proposed.SourceText) == "" {
			return true
		}
	}
	return false
}

// repairBudget is how many of a passage's tokens may differ from the diary. The floor of one
// exists because a passage cut mid-sentence needs its ending repaired no matter how short it
// is, and a ratio alone would forbid that on a five-word scene.
func repairBudget(passageTokens int) int {
	budget := int(math.Ceil(values.EncodeSourceTextMaxRepairedRatio * float64(passageTokens)))
	if budget < 1 {
		return 1
	}
	return budget
}

// traceToDiary finds the diary token a passage token came from, preferring an exact match so a
// repaired token never consumes a coverage slot an identical word could have used. The returned
// bool distinguishes "quoted" from "repaired"; an empty match means the token is novel.
func traceToDiary(token string, remaining map[string]int, distinct []string) (match string, exact bool) {
	if _, ok := remaining[token]; ok {
		return token, true
	}
	best, bestDistance := "", 0
	for _, candidate := range distinct {
		if sharedPrefixRunes(token, candidate) < sourceTextRepairMinSharedPrefixRunes {
			continue
		}
		distance := editDistance(token, candidate)
		if distance > values.EncodeSourceTextMaxRepairEditDistance {
			continue
		}
		if best == "" || distance < bestDistance {
			best, bestDistance = candidate, distance
		}
	}
	return best, false
}

// sourceTextTokens reduces text to comparable words: maximal runs of letters and digits, with
// punctuation and whitespace dropped. Korean is written without word-internal separators, so a
// token is an eojeol (stem plus its attached particle or ending) — which is exactly the unit an
// ending repair changes and a word substitution replaces.
func sourceTextTokens(text string) []string {
	return strings.FieldsFunc(text, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
}

func sharedPrefixRunes(a string, b string) int {
	shared := 0
	aRunes, bRunes := []rune(a), []rune(b)
	for shared < len(aRunes) && shared < len(bRunes) && aRunes[shared] == bRunes[shared] {
		shared++
	}
	return shared
}

// editDistance is Levenshtein over runes — over runes and not bytes because one mistyped Korean
// syllable is three bytes, which a byte-wise distance would score as three separate edits.
func editDistance(a string, b string) int {
	aRunes, bRunes := []rune(a), []rune(b)
	previous := make([]int, len(bRunes)+1)
	current := make([]int, len(bRunes)+1)
	for j := range previous {
		previous[j] = j
	}
	for i := 1; i <= len(aRunes); i++ {
		current[0] = i
		for j := 1; j <= len(bRunes); j++ {
			substitution := previous[j-1]
			if aRunes[i-1] != bRunes[j-1] {
				substitution++
			}
			current[j] = min(previous[j]+1, current[j-1]+1, substitution)
		}
		previous, current = current, previous
	}
	return previous[len(bRunes)]
}
