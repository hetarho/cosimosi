package memory

import (
	"math"
	"sort"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

// Forgetting decay ([F]) is the read-time math that dims a memory and erases its words as universe
// time passes without recall. Every function here is a pure, IO-free domain service (§2.5): no
// clock, DB, transport, SDK, or ambient randomness (the word-removal PRNG is a seeded argument),
// so the FE render mirror in packages/memory-logic and the server compute the *same* decay, pinned
// by the shared golden fixture. Nothing is ever deleted — brightness and text stop at a floor and
// wait for recall to revive them (the silent engram, [F2][I1]).

// redactionToken is the visual marker a removed word becomes ("나는 오늘 xxxx 파스타랑 …"). It is UI
// content owned with the algorithm, not a tuning value (rendered by the forgetting-visuals unit).
const redactionToken = "xxxx"

// EffectiveElapsedDays is the offset-inclusive recency clock both EffectiveBrightness and DecayStage
// consume, so brightness and stage move together ([F1]). Universe-days elapse from the last recall,
// or from creation when a memory has never been recalled (a never-recalled memory still forgets). The
// signed neighbor forgetting_offset_days (CC4, written on a *neighbor's* recall by reconsolidation)
// shifts that age and is floored at 0 so an offset can never make a memory younger than new ([I10]).
func EffectiveElapsedDays(now time.Time, lastRecalled *time.Time, created time.Time, offsetDays float64) float64 {
	anchor := created
	if lastRecalled != nil {
		anchor = *lastRecalled
	}
	// Universe times are date-only ([T5]); truncate to the UTC day so elapsed is whole universe-days
	// exactly as the TS mirror (which parses date-only strings) computes it — golden-parity ([A10]).
	elapsed := math.Max(0, utcDate(now).Sub(utcDate(anchor)).Hours()/24)
	return math.Max(0, elapsed+offsetDays)
}

// EffectiveBrightness is the read-time brightness of a memory ([F1][F2]): a floored exponential fade
// of the offset-inclusive elapsed days, stretched (slowed) by arousal ([F6]) and connection strength
// ([F7]). The curve shape is a formula (code); only the coefficients and floor are values. It is 1.0
// at elapsed 0, monotone non-increasing in elapsed, and clamped into [brightness_floor, 1] — never
// below the floor, never 0 (the stored fact is never mutated by reading).
func EffectiveBrightness(effectiveElapsedDays float64, arousal float64, effectiveStrength float64) float64 {
	floor := values.ForgettingBrightnessFloor
	days := math.Max(0, effectiveElapsedDays)
	slow := slowFactor(arousal, effectiveStrength)
	decayFactor := clamp(1-values.ForgettingBrightnessDecayPerDay, 0, 1)
	brightness := floor + (1-floor)*math.Pow(decayFactor, days/slow)
	return clamp(brightness, floor, 1)
}

// DecayStage is the discrete forgetting stage 0..maxStage a memory has reached — a monotone
// non-decreasing step function of the *same* effective elapsed days and the *same* slow factor as
// EffectiveBrightness, so stage and brightness stay consistent ([F1]). Stage 0 is vivid; the maximum
// stage is the derived length of forgetting.stage_word_removal_ratios — there is no stage past the
// last ([F2]).
func DecayStage(effectiveElapsedDays float64, arousal float64, effectiveStrength float64) int {
	maxStage := len(values.ForgettingStageWordRemovalRatios)
	days := math.Max(0, effectiveElapsedDays)
	slow := slowFactor(arousal, effectiveStrength)
	raw := int(math.Floor(days / (values.ForgettingStageIntervalDays * slow)))
	if raw < 0 {
		return 0
	}
	if raw > maxStage {
		return maxStage
	}
	return raw
}

// DecayStageText produces the stage-`stage` decay text from a memory's current text by removing a
// per-stage ratio of words at random and replacing each with the redaction token ([F1][F9]). It is
// deterministic given (currentText, stage, seed): the randomness is the seeded PRNG, so client and
// server redact identically (golden-parity). Stage 0 (or below) is the vivid, unredacted text;
// stages 1..maxStage use forgetting.stage_word_removal_ratios[stage-1] (stage 0 is the reserved
// vivid state, so the ratios describe the decayed stages). Removal is a prefix of one seed-ordered
// list, so stage k+1 removes a superset of stage k ([F1] nesting). Structure is preserved: the first
// and last word of every sentence is never removed and content words are removed before function
// words, so even the deepest stage stays a non-empty, legible fragment ([F2][F9]).
func DecayStageText(currentText string, stage int, seed int64) string {
	words := strings.Fields(currentText)
	if stage <= 0 || len(words) <= 2 {
		return strings.Join(words, " ")
	}
	ratios := values.ForgettingStageWordRemovalRatios
	if stage > len(ratios) {
		stage = len(ratios)
	}
	ratio := ratios[stage-1]

	removable := removableIndices(words)
	if len(removable) == 0 {
		return strings.Join(words, " ")
	}
	// One seed-ordered removal list (content words first, then a stable seeded tiebreak); taking a
	// prefix per stage makes each deeper stage a superset of the shallower one.
	order := seededRemovalOrder(words, removable, seed)
	removeCount := int(math.Floor(ratio * float64(len(order))))
	if removeCount > len(order) {
		removeCount = len(order)
	}

	result := make([]string, len(words))
	copy(result, words)
	for _, index := range order[:removeCount] {
		result[index] = redactionToken
	}
	return strings.Join(result, " ")
}

// DecayDepth normalizes forgetting progress to [0, 1] — the continuous stage-fraction over the same
// slow-stretched elapsed clock DecayStage crosses (0 = fresh, 1 = at/after the deepest stage). It is
// the normalized input the accessibility-cost weight reads, so the two axes speak one normalized
// language independent of how many decay stages exist ([F1][F4]). Recall resets decay → depth 0.
func DecayDepth(effectiveElapsedDays float64, arousal float64, effectiveStrength float64) float64 {
	maxStage := len(values.ForgettingStageWordRemovalRatios)
	span := values.ForgettingStageIntervalDays * float64(maxStage) * slowFactor(arousal, effectiveStrength)
	if span <= 0 {
		return 0
	}
	return clamp(math.Max(0, effectiveElapsedDays)/span, 0, 1)
}

// AccessibilityCostWeight turns a memory's normalized forgetting depth into an accessibility/cost
// weight ([F4]): a monotone convex ease from cost_weight_floor (depth 0 — fully accessible, cheapest
// but never free [G1]) to cost_weight_cap (depth 1 — silent engram, expensive but bounded, never
// unreachable [I1][F2]). Deeper decay ⇒ harder to reach ⇒ costlier. It emits a weight, not a Twinkle
// price — the recall pricing layer turns this weight into a price and its spend gate re-derives the
// weight server-side (this unit computes accessibility; pricing and spending live in the Twinkle
// economy). The curve shape + clamp are code; only the floor, cap, and curvature are values. Recall
// resets decay to depth 0, so the weight returns to the floor ([F5]).
func AccessibilityCostWeight(decayDepth float64) float64 {
	weightFloor := float64(values.ForgettingCostWeightFloor)
	weightCap := float64(values.ForgettingCostWeightCap)
	depth := clamp(decayDepth, 0, 1)
	weight := weightFloor + (weightCap-weightFloor)*math.Pow(depth, values.ForgettingCostWeightCurve)
	return clamp(weight, weightFloor, weightCap)
}

// slowFactor stretches the decay time-axis by arousal and connection strength — both non-negative,
// so the factor is >= 1 and division by it always slows (never speeds) the fade ([F6][F7]).
func slowFactor(arousal float64, effectiveStrength float64) float64 {
	return 1 +
		math.Max(0, arousal)*values.ForgettingArousalSlowCoefficient +
		math.Max(0, effectiveStrength)*values.ForgettingConnectionSlowCoefficient
}

// removableIndices returns the word indices eligible for redaction: every word except the first and
// last of each sentence, which anchor the skeleton so a redacted text stays legible-as-fragments.
func removableIndices(words []string) []int {
	protected := make(map[int]bool, len(words))
	protected[0] = true
	protected[len(words)-1] = true
	for i, word := range words {
		if endsSentence(word) {
			protected[i] = true
			if i+1 < len(words) {
				protected[i+1] = true
			}
		}
	}
	removable := make([]int, 0, len(words))
	for i := range words {
		if !protected[i] {
			removable = append(removable, i)
		}
	}
	return removable
}

// seededRemovalOrder orders the removable indices so content words are removed before function
// words (preserving the grammatical skeleton), with a deterministic seeded tiebreak. The order is
// independent of stage, so a prefix of it gives the nested superset property.
func seededRemovalOrder(words []string, removable []int, seed int64) []int {
	order := make([]int, len(removable))
	copy(order, removable)
	sort.SliceStable(order, func(a, b int) bool {
		indexA, indexB := order[a], order[b]
		stopA, stopB := isStopWord(words[indexA]), isStopWord(words[indexB])
		if stopA != stopB {
			return !stopA // content words (non-stop) first
		}
		rankA, rankB := seededRank(seed, indexA), seededRank(seed, indexB)
		if rankA != rankB {
			return rankA < rankB
		}
		return indexA < indexB
	})
	return order
}

// seededRank is a deterministic uint32 hash of (seed, index) — a splitmix32-style finalizer using
// only uint32 wraparound arithmetic so the Go and TS mirrors (Math.imul + >>> 0) produce identical
// ranks. This is the whole source of "randomness"; there is no ambient RNG (purity, [A11]).
func seededRank(seed int64, index int) uint32 {
	x := uint32(seed) + uint32(index)*0x9e3779b1
	x ^= x >> 16
	x *= 0x7feb352d
	x ^= x >> 15
	x *= 0x846ca68b
	x ^= x >> 16
	return x
}

// endsSentence reports whether a word carries sentence-final punctuation, marking a sentence
// boundary for the first/last-word guard. Language-agnostic v1 set (Latin + CJK terminators);
// trailing closing quotes/brackets are stripped first so `hello."` still reads as a sentence end.
func endsSentence(word string) bool {
	runes := []rune(word)
	end := len(runes)
	for end > 0 && isClosingPunct(runes[end-1]) {
		end--
	}
	if end == 0 {
		return false
	}
	switch runes[end-1] {
	case '.', '!', '?', '。', '！', '？', '…':
		return true
	default:
		return false
	}
}

func isClosingPunct(r rune) bool {
	switch r {
	case '"', '\'', ')', ']', '}', '”', '’', '」', '』', '）', '》':
		return true
	default:
		return false
	}
}

// isStopWord is the v1 language-agnostic function-word heuristic: a small set of common English and
// standalone Korean function words removed only after content words. The exact membership is code
// content (a "to refine" per [F9]), refinable toward per-language POS without reshaping the contract.
func isStopWord(word string) bool {
	return forgettingStopWords[strings.ToLower(strings.Trim(word, ".,!?;:\"'()。！？…"))]
}

var forgettingStopWords = map[string]bool{
	"a": true, "an": true, "the": true, "and": true, "or": true, "but": true, "so": true,
	"of": true, "to": true, "in": true, "on": true, "at": true, "by": true, "for": true,
	"with": true, "as": true, "is": true, "am": true, "are": true, "was": true, "were": true,
	"be": true, "i": true, "you": true, "he": true, "she": true, "it": true, "we": true,
	"they": true, "my": true, "me": true, "this": true, "that": true,
	"그리고": true, "그래서": true, "그러나": true, "하지만": true, "나는": true, "내가": true, "오늘": true,
}
