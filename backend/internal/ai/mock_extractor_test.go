package ai

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

func TestMockExtractorMultiSceneSentences(t *testing.T) {
	// The DoD example: three scenes split by sentence boundaries, no blank lines.
	text := "아침엔 카페에서 회의했다. 점심엔 친구와 싸워서 화가 났다. 저녁엔 집에서 평온했다."
	ext, err := NewMockExtractor().Extract(context.Background(), text)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if len(ext.Segments) < 2 {
		t.Fatalf("multi-scene diary produced %d segment(s), want >= 2", len(ext.Segments))
	}
	for i, s := range ext.Segments {
		if s.Index != i {
			t.Fatalf("segment %d has Index %d, want contiguous 0-based", i, s.Index)
		}
		if s.Mood != MoodNeutral {
			t.Fatalf("segment %d Mood = %q, want neutral", i, s.Mood)
		}
		if s.Intensity != 0 || s.Valence != 0 {
			t.Fatalf("segment %d Intensity/Valence = %v/%v, want 0/0", i, s.Intensity, s.Valence)
		}
	}
}

func TestMockExtractorParagraphsWinOverSentences(t *testing.T) {
	text := "오전엔 도서관에 갔다. 책을 두 권 빌렸다.\n\n오후엔 공원을 걸었다. 바람이 좋았다."
	ext, _ := NewMockExtractor().Extract(context.Background(), text)
	if len(ext.Segments) != 2 {
		t.Fatalf("2 paragraphs produced %d segments, want 2 (paragraph split wins)", len(ext.Segments))
	}
}

func TestMockExtractorSingleSceneSingleSegment(t *testing.T) {
	for _, text := range []string{
		"오늘은 종일 비가 와서 집에만 있었다",   // no terminator at all
		"무탈하게 평범한 하루를 보냈다.",        // one sentence
	} {
		ext, _ := NewMockExtractor().Extract(context.Background(), text)
		if len(ext.Segments) != 1 {
			t.Fatalf("%q produced %d segments, want exactly 1", text, len(ext.Segments))
		}
	}
}

func TestMockExtractorClampMergesTailWithoutLosingText(t *testing.T) {
	parts := []string{"하나.", "둘.", "셋.", "넷.", "다섯.", "여섯.", "일곱.", "여덟.", "아홉."}
	text := strings.Join(parts, " ")
	ext, _ := NewMockExtractor().Extract(context.Background(), text)
	if len(ext.Segments) != maxSegments {
		t.Fatalf("9 sentences produced %d segments, want clamp to %d", len(ext.Segments), maxSegments)
	}
	var joined strings.Builder
	for _, s := range ext.Segments {
		joined.WriteString(s.Text)
		joined.WriteString(" ")
	}
	for _, p := range parts {
		if !strings.Contains(joined.String(), p) {
			t.Fatalf("clamp dropped text %q — overflow must merge, not drop", p)
		}
	}
}

func TestMockExtractorDeterministic(t *testing.T) {
	text := "아침에 달렸다. 낮엔 일했다.\n\n밤엔 책을 읽었다."
	a, _ := NewMockExtractor().Extract(context.Background(), text)
	b, _ := NewMockExtractor().Extract(context.Background(), text)
	if !reflect.DeepEqual(a, b) {
		t.Fatalf("same input produced different segments:\n%v\n%v", a, b)
	}
}

func TestMockExtractorEmptyInputFallsBack(t *testing.T) {
	ext, _ := NewMockExtractor().Extract(context.Background(), "   \n  ")
	if len(ext.Segments) != 1 {
		t.Fatalf("empty input produced %d segments, want the 1-segment fallback", len(ext.Segments))
	}
}
