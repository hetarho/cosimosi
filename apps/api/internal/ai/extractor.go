package ai

import (
	"context"
	"math"
	"strings"

	"github.com/cosimosi/backend/internal/values"
)

// Extractor is the LLM extraction port (spec 20): split a diary into 1..N
// event-boundary segments, each with mood (13-value enum, spec 29), intensity
// (arousal) and valence. Adapters (mock, OpenAI, …) slot in behind this same
// interface (Architecture §4.7); spec 21 calls it from the worker to fan the
// segments out into stars.
type Extractor interface {
	Extract(ctx context.Context, text string) (Extraction, error)
}

// maxSegments is the segmentation ceiling (spec 20 분절 params: count clamped
// to [1,5], hard cap 8). The prompt instructs the bound; this code re-applies
// it so a rubric-violating LLM response still cannot blow up downstream
// (concept §4.6). Overflow segments are MERGED into the last kept one, never
// dropped — every word of the diary stays in exactly one segment, so spec 21's
// embedding fan-out never loses text (and the count stays ≤5, under the cap).
const maxSegments = values.ExtractionMaxSegments

// NoopExtractor returns the whole text as a single neutral segment — the
// fallback shape itself. It lets the pipeline depend on the Extractor port
// without paying for an LLM call, while still honoring the ≥1-segment guarantee.
type NoopExtractor struct{}

func (NoopExtractor) Extract(_ context.Context, text string) (Extraction, error) {
	return fallbackExtraction(text, MoodUnspecified, 0), nil
}

// --- shared validation / normalization / fallback (spec 20, concept §4.6) ---
// Every adapter funnels its raw segments through normalizeExtraction so the
// guarantees (count ∈ [1,5], whitelisted mood, clamped intensity/valence,
// contiguous 0-based indexes, non-empty text) hold no matter how broken the
// LLM output was.

// moodWhitelist is the closed set of accepted mood strings (spec 29's 13 values).
// Anything else — hallucinated labels, casing surprises — degrades to neutral.
var moodWhitelist = map[Mood]bool{
	MoodJoy: true, MoodCalm: true, MoodSad: true, MoodAnger: true,
	MoodFear: true, MoodLove: true, MoodNeutral: true, MoodExcitement: true,
	MoodGratitude: true, MoodRelief: true, MoodStress: true, MoodTired: true,
	MoodEmptiness: true,
}

// normalizeMood maps a raw mood onto the 13-value whitelist; unknown values
// (and the empty "unspecified") become neutral so a segment never carries an
// unrenderable mood.
func normalizeMood(raw Mood) Mood {
	m := Mood(strings.ToLower(strings.TrimSpace(string(raw))))
	if moodWhitelist[m] {
		return m
	}
	return MoodNeutral
}

// clampRange clamps v into [lo, hi]; NaN becomes 0 (the neutral value for both
// intensity's [0,1] and valence's [-1,1]).
func clampRange(v, lo, hi float64) float64 {
	if math.IsNaN(v) {
		return 0
	}
	return math.Min(hi, math.Max(lo, v))
}

// collapseSpace trims and squeezes all runs of whitespace to single spaces.
func collapseSpace(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// fallbackExtraction is the single-segment degradation path (concept §4.6 "LLM
// 출력은 깨질 수 있다"): the whole original text as one segment, with the caller's
// hints (e.g. the user-picked mood/intensity, spec 21) or neutral defaults.
// It is a NORMAL path, not an error — a diary never yields zero stars.
func fallbackExtraction(text string, hintMood Mood, hintIntensity float64) Extraction {
	return Extraction{Segments: []Segment{{
		Index:     0,
		Text:      strings.TrimSpace(text),
		Mood:      normalizeMood(hintMood),
		Intensity: clampRange(hintIntensity, 0, 1),
		Valence:   0,
	}}}
}

// normalizeExtraction filters raw adapter segments into the guaranteed shape:
// empty-text segments are dropped, mood is whitelisted, intensity/valence are
// clamped ([0,1] / [-1,1], NaN→0), overflow beyond maxSegments is merged into
// the last segment, and indexes are reassigned 0-based contiguous. If nothing
// usable survives, it degrades to fallbackExtraction(original).
func normalizeExtraction(raw []Segment, original string) Extraction {
	segs := make([]Segment, 0, len(raw))
	for _, s := range raw {
		text := collapseSpace(s.Text)
		if text == "" {
			continue
		}
		segs = append(segs, Segment{
			Text:      text,
			Mood:      normalizeMood(s.Mood),
			Intensity: clampRange(s.Intensity, 0, 1),
			Valence:   clampRange(s.Valence, -1, 1),
			Entities:  s.Entities,
		})
	}
	if len(segs) == 0 {
		return fallbackExtraction(original, MoodUnspecified, 0)
	}
	// Clamp [1,5]: merge the tail into the last kept segment so no text is lost.
	if len(segs) > maxSegments {
		last := &segs[maxSegments-1]
		for _, extra := range segs[maxSegments:] {
			last.Text += " " + extra.Text
		}
		segs = segs[:maxSegments]
	}
	for i := range segs {
		segs[i].Index = i
	}
	return Extraction{Segments: segs}
}
