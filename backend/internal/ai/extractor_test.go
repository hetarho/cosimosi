package ai

import (
	"context"
	"errors"
	"math"
	"strings"
	"testing"

	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/platform/config"
)

const originalDiary = "오늘 하루의 원문 일기다. 어떤 일이 있었고, 어떤 기분이었다."

func assertSingleFallback(t *testing.T, ext Extraction) {
	t.Helper()
	if len(ext.Segments) != 1 {
		t.Fatalf("fallback produced %d segments, want exactly 1", len(ext.Segments))
	}
	s := ext.Segments[0]
	if s.Index != 0 || s.Text != originalDiary || s.Mood != MoodNeutral || s.Valence != 0 {
		t.Fatalf("fallback segment = %+v, want whole original text + neutral + valence 0", s)
	}
}

func TestDecodeSegmentsRejectsUnusableContent(t *testing.T) {
	for _, raw := range []string{`{"segments": [ broken`, `{"segments": []}`, `{"foo": 1}`, ``} {
		if _, err := decodeSegments(raw); err == nil {
			t.Fatalf("unusable response %q should error so the caller falls back", raw)
		}
	}
	// The fallback the caller then builds is the whole original as one segment.
	assertSingleFallback(t, fallbackExtraction(originalDiary, MoodUnspecified, 0))
}

func TestDecodeSegmentsThenNormalizeClampsMoodIntensityValence(t *testing.T) {
	raw := `{"segments": [
	  {"index": 7, "text": "  알 수 없는   감정  ", "mood": "ecstatic", "intensity": 1.5, "valence": -3,
	   "entities": {"people": [], "places": [], "topics": []}},
	  {"index": 0, "text": "분노", "mood": "ANGER", "intensity": -0.5, "valence": 2,
	   "entities": {"people": ["친구"], "places": [], "topics": ["다툼"]}}
	]}`
	segs, err := decodeSegments(raw)
	if err != nil {
		t.Fatalf("valid JSON should decode: %v", err)
	}
	ext := normalizeExtraction(segs, originalDiary)
	if len(ext.Segments) != 2 {
		t.Fatalf("got %d segments, want 2", len(ext.Segments))
	}
	a, b := ext.Segments[0], ext.Segments[1]
	if a.Mood != MoodNeutral {
		t.Fatalf("unknown mood mapped to %q, want neutral", a.Mood)
	}
	if a.Text != "알 수 없는 감정" {
		t.Fatalf("text not whitespace-normalized: %q", a.Text)
	}
	if a.Intensity != 1 || a.Valence != -1 {
		t.Fatalf("clamps: intensity=%v want 1, valence=%v want -1", a.Intensity, a.Valence)
	}
	if a.Index != 0 || b.Index != 1 {
		t.Fatalf("indexes not reassigned 0-based: %d, %d", a.Index, b.Index)
	}
	if b.Mood != MoodAnger {
		t.Fatalf("case-insensitive whitelist failed: %q", b.Mood)
	}
	if b.Intensity != 0 || b.Valence != 1 {
		t.Fatalf("clamps: intensity=%v want 0, valence=%v want 1", b.Intensity, b.Valence)
	}
	if len(b.Entities.People) != 1 || b.Entities.People[0] != "친구" {
		t.Fatalf("entities lost: %+v", b.Entities)
	}
}

func TestNormalizeExtractionNaNAndEmptyText(t *testing.T) {
	ext := normalizeExtraction([]Segment{
		{Text: "   "}, // dropped
		{Text: "유효", Mood: MoodJoy, Intensity: math.NaN(), Valence: math.NaN()},
	}, originalDiary)
	if len(ext.Segments) != 1 {
		t.Fatalf("got %d segments, want 1 (blank dropped)", len(ext.Segments))
	}
	s := ext.Segments[0]
	if s.Intensity != 0 || s.Valence != 0 {
		t.Fatalf("NaN not neutralized: intensity=%v valence=%v", s.Intensity, s.Valence)
	}
}

func TestNoopExtractorAlwaysOneSegment(t *testing.T) {
	ext, err := NoopExtractor{}.Extract(context.Background(), originalDiary)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	assertSingleFallback(t, ext)
}

func TestSegmentSeedDeterministicAndNormalized(t *testing.T) {
	a := SegmentSeed("diary-1", 0, "아침에 커피를 마셨다")
	if b := SegmentSeed("diary-1", 0, "아침에 커피를 마셨다"); b != a {
		t.Fatal("same input produced different seeds")
	}
	// Cosmetic edits (case, whitespace runs) must not move the star.
	if b := SegmentSeed("diary-1", 0, "  아침에   커피를 마셨다 "); b != a {
		t.Fatal("whitespace normalization not applied to seed")
	}
	if SegmentSeed("diary-1", 1, "아침에 커피를 마셨다") == a {
		t.Fatal("different fragment index produced the same seed")
	}
	if SegmentSeed("diary-2", 0, "아침에 커피를 마셨다") == a {
		t.Fatal("different diary produced the same seed")
	}
	if SegmentSeed("MixedCase", 0, "Latin Text") != SegmentSeed("MixedCase", 0, "latin text") {
		t.Fatal("lowercasing not applied to seed text")
	}
}

// stubLLM is a canned llm.Client for exercising LLMExtractor without HTTP.
type stubLLM struct {
	text string
	err  error
}

func (s stubLLM) Complete(context.Context, llm.Request) (llm.Response, error) {
	return llm.Response{Text: s.text}, s.err
}
func (s stubLLM) Model() string { return "stub/test" }

func TestLLMExtractorCacheNotCorruptedByCallerMutation(t *testing.T) {
	raw := `{"segments":[{"index":0,"text":"조각","mood":"joy","intensity":0.5,"valence":0.5,
	  "entities":{"people":["친구"],"places":[],"topics":[]}}]}`
	e := NewLLMExtractor(stubLLM{text: raw})
	first, err := e.Extract(context.Background(), "원문 일기")
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	first.Segments[0].Text = "오염"
	first.Segments[0].Entities.People[0] = "오염"
	second, _ := e.Extract(context.Background(), "원문 일기")
	if second.Segments[0].Text != "조각" || second.Segments[0].Entities.People[0] != "친구" {
		t.Fatalf("caller mutation leaked into the cache: %+v", second.Segments[0])
	}
}

func TestLLMExtractorContentGarbageFallsBackTransportErrorPropagates(t *testing.T) {
	ext, err := NewLLMExtractor(stubLLM{text: "not json at all"}).Extract(context.Background(), originalDiary)
	if err != nil {
		t.Fatalf("content garbage must fall back, not error: %v", err)
	}
	assertSingleFallback(t, ext)

	if _, err := NewLLMExtractor(stubLLM{err: errors.New("boom")}).Extract(context.Background(), originalDiary); err == nil {
		t.Fatal("transport error must propagate for worker backoff")
	}
}

func TestNewExtractorSelection(t *testing.T) {
	if _, err := NewExtractor(&config.Config{AIExtractor: "mock"}, nil); err != nil {
		t.Fatalf("mock: %v", err)
	}
	if _, err := NewExtractor(&config.Config{AIExtractor: ""}, nil); err != nil {
		t.Fatalf("default should be mock: %v", err)
	}
	if ext, err := NewExtractor(&config.Config{AIExtractor: "llm", LLMProvider: "openai", OpenAIAPIKey: "sk-test"}, nil); err != nil {
		t.Fatalf("llm+key: %v", err)
	} else if _, ok := ext.(*LLMExtractor); !ok {
		t.Fatalf("llm should build *LLMExtractor, got %T", ext)
	}
	// Injected client (the spec-34 Resolver path) wins over env config —
	// no env key needed when a client is supplied.
	if ext, err := NewExtractor(&config.Config{AIExtractor: "llm"}, stubLLM{text: "{}"}); err != nil {
		t.Fatalf("llm+injected client: %v", err)
	} else if _, ok := ext.(*LLMExtractor); !ok {
		t.Fatalf("injected client should build *LLMExtractor, got %T", ext)
	}
	if _, err := NewExtractor(&config.Config{AIExtractor: "llm", LLMProvider: "openai"}, nil); err == nil ||
		!strings.Contains(err.Error(), "OPENAI_API_KEY") {
		t.Fatalf("llm without key should fail fast naming the env var, got %v", err)
	}
	if _, err := NewExtractor(&config.Config{AIExtractor: "banana"}, nil); err == nil ||
		!strings.Contains(err.Error(), "unknown AI_EXTRACTOR") {
		t.Fatalf("unknown extractor should error, got %v", err)
	}
}
