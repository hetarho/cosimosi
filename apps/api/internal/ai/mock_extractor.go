package ai

import (
	"context"
	"strings"
)

// MockExtractor splits a diary deterministically with zero API calls — the
// keyless default (spec 20, acceptance 1.6), mirroring MockEmbedder's philosophy:
// it models STABILITY, not semantics. Boundaries are structural, the only thing
// detectable without an LLM: blank-line paragraphs first, else sentences. Every
// segment is neutral (Mood neutral, Intensity 0, Valence 0, empty Entities);
// real affect extraction is the OpenAI adapter's job. Identical input always
// yields identical segments, so keyless E2E and tests are reproducible.
type MockExtractor struct{}

// NewMockExtractor builds the keyless deterministic extractor.
func NewMockExtractor() *MockExtractor {
	return &MockExtractor{}
}

func (MockExtractor) Extract(_ context.Context, text string) (Extraction, error) {
	parts := splitParagraphs(text)
	if len(parts) < 2 {
		parts = splitSentences(text)
	}
	segs := make([]Segment, 0, len(parts))
	for _, p := range parts {
		segs = append(segs, Segment{Text: p, Mood: MoodNeutral})
	}
	// normalizeExtraction applies the shared guarantees: [1,5] clamp (tail
	// merged), 0-based indexes, and the single-segment fallback on empty input.
	return normalizeExtraction(segs, text), nil
}

// splitParagraphs cuts on blank lines — the strongest structural boundary a
// diarist writes on purpose.
func splitParagraphs(text string) []string {
	var out []string
	var cur strings.Builder
	flush := func() {
		if p := strings.TrimSpace(cur.String()); p != "" {
			out = append(out, p)
		}
		cur.Reset()
	}
	for _, line := range strings.Split(text, "\n") {
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		cur.WriteString(line)
		cur.WriteString("\n")
	}
	flush()
	return out
}

// splitSentences cuts after sentence terminators (. ! ?) and single newlines —
// the crude proxy for event boundaries when there are no paragraphs. A diary
// with no terminators at all stays one piece (single continuous scene → one
// segment, acceptance 1.2).
func splitSentences(text string) []string {
	var out []string
	var cur strings.Builder
	flush := func() {
		if s := strings.TrimSpace(cur.String()); s != "" {
			out = append(out, s)
		}
		cur.Reset()
	}
	for _, r := range text {
		switch r {
		case '\n':
			flush()
		case '.', '!', '?':
			cur.WriteRune(r)
			flush()
		default:
			cur.WriteRune(r)
		}
	}
	flush()
	return out
}
