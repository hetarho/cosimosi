package ai

import (
	"context"
	"testing"

	"github.com/cosimosi/backend/internal/platform/config"
)

// NoopRewriter is the "AI off / demo" path: it returns the text unchanged so the worker
// treats it as a graceful no-op (spec 54 A5 — 데모·AI 없음에서도 기존 내용으로 정상 렌더).
func TestNoopRewriterReturnsUnchanged(t *testing.T) {
	out, err := NoopRewriter{}.Rewrite(context.Background(), "그날의 기억", 4)
	if err != nil {
		t.Fatalf("noop rewrite err: %v", err)
	}
	if out != "그날의 기억" {
		t.Fatalf("noop should return input unchanged, got %q", out)
	}
}

// The blur strength must scale with the abstraction stage (spec 54 A2: 단계가 높을수록 변형 폭↑) —
// stages 2/3/4 produce distinct, non-empty prompt directives.
func TestRewriteStrengthScalesWithStage(t *testing.T) {
	s2, s3, s4 := rewriteStrength(2), rewriteStrength(3), rewriteStrength(4)
	if s2 == s3 || s3 == s4 || s2 == s4 {
		t.Fatalf("strength should differ by stage: 2=%q 3=%q 4=%q", s2, s3, s4)
	}
	if s2 == "" || s4 == "" {
		t.Fatal("rewrite strength must be non-empty (the prompt depends on it)")
	}
}

// NewRewriter mirrors NewExtractor (spec 34): no ConfigSource pins the no-op (no env without
// admin wiring ever rewrites); a source builds the admin-followed switch. stubLLM/stubSource
// are defined in extractor_test.go (same package).
func TestNewRewriterSelection(t *testing.T) {
	if rw := NewRewriter(&config.Config{}, nil, nil); rw == nil {
		t.Fatal("without source: nil rewriter")
	} else if _, ok := rw.(NoopRewriter); !ok {
		t.Fatalf("without source should be NoopRewriter, got %T", rw)
	}
	if rw := NewRewriter(&config.Config{}, stubLLM{text: "x"}, stubSource{}); rw == nil {
		t.Fatal("with source: nil rewriter")
	} else if _, ok := rw.(*SwitchingRewriter); !ok {
		t.Fatalf("with source should be *SwitchingRewriter, got %T", rw)
	}
}
