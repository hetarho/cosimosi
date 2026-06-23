package ai

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/cosimosi/backend/internal/llm"
)

// Rewriter is the reconsolidation content-rewrite port (spec 54): re-tell a star's
// DISPLAYED text, blurred/abstracted proportional to its abstraction stage — the
// "기억은 떠올릴 때마다 다시 쓰인다" process made literal. Adapters (LLM, noop) slot
// behind the same interface (constitution §7). The job worker calls it asynchronously
// (AI cost/latency); the immutable original diary record is NEVER touched (헌법1) — the
// rewrite lands only on the star's append-only variant log.
type Rewriter interface {
	// Rewrite returns a re-told version of text at the given abstraction stage. Returning
	// text UNCHANGED means "no rewrite happened" (no active AI / unusable output) — a NORMAL
	// path the caller treats as a graceful no-op (A5), not an error. A transport failure
	// surfaces as an error so the worker backs off and retries; the displayed text stays as-is.
	Rewrite(ctx context.Context, text string, stage int) (string, error)
}

// NoopRewriter returns the text unchanged — the "AI off / demo" path (spec 54 A5:
// 데모·AI 없음에서도 별은 기존 내용으로 정상 렌더, 변형 skip). It lets the worker depend on
// the Rewriter port without an LLM call while honoring the no-op contract.
type NoopRewriter struct{}

func (NoopRewriter) Rewrite(_ context.Context, text string, _ int) (string, error) {
	return text, nil
}

// rewriteMaxTokens caps one rewrite response — a re-told fragment is ~the input length;
// generous so dense CJK output isn't truncated.
const rewriteMaxTokens = 4096

// LLMRewriter is the real Rewriter: it owns the stage-parameterized prompt and validation,
// and calls whatever provider sits behind the llm.Client port (constitution §7). Transport
// errors propagate (worker retries); unusable content (empty / absurdly long) degrades to the
// ORIGINAL text (graceful no-op, concept §4.6) so a broken model never blanks a memory.
type LLMRewriter struct {
	client llm.Client
}

// NewLLMRewriter wires the rewriter over an LLM provider client.
func NewLLMRewriter(client llm.Client) *LLMRewriter {
	return &LLMRewriter{client: client}
}

func (r *LLMRewriter) Rewrite(ctx context.Context, text string, stage int) (string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return text, nil // nothing to rewrite
	}
	// MIRRORS the embedder/extractor input cap (openai.go maxInputRunes): a last-resort guard.
	input := text
	if utf8.RuneCountInString(text) > maxInputRunes {
		input = string([]rune(text)[:maxInputRunes])
	}
	resp, err := r.client.Complete(ctx, llm.Request{
		System:    rewriteSystemPrompt(stage),
		User:      input,
		MaxTokens: rewriteMaxTokens,
	})
	if err != nil {
		// Transport-level failure: NOT a no-op — let the worker back off and retry so a
		// transient provider outage doesn't get recorded as a (non-)rewrite.
		return "", fmt.Errorf("llm rewrite: %w", err)
	}
	out := strings.TrimSpace(resp.Text)
	// Content-level guard: empty or runaway output → keep the original (graceful no-op).
	if out == "" || utf8.RuneCountInString(out) > maxInputRunes {
		slog.Warn("rewrite fallback (unusable output)", "model", r.client.Model(), "stage", stage)
		return text, nil
	}
	return out, nil
}

// rewriteSystemPrompt is the reconsolidation rubric (spec 54). The blur STRENGTH scales with
// the abstraction stage (2=아주 약간, 3=꽤, 4=많이) — the prompt is a code asset, not a values
// scalar (the threshold/debounce live in spec/values.yaml rewrite.*). It must keep the gist +
// core emotion while fading detail, and must NOT invent new facts (a memory blurs, it doesn't grow).
func rewriteSystemPrompt(stage int) string {
	return fmt.Sprintf(`너는 사람이 오래된 기억을 '다시 떠올릴 때' 일어나는 재공고화를 흉내 낸다. 주어진 기억 텍스트를
%s 다시 쓴다 — 요점과 핵심 감정은 유지하되 세부(구체적 수치·고유명사·정확한 표현)는 흐리게, 더 일반적이고 주관적인
인상으로 바꾼다.
규칙:
- 원문 언어를 유지한다(한국어면 한국어).
- 길이는 원문과 비슷하게 — 요약이 아니라 '다시 쓴 한 편'이다.
- 없던 사건·인물·사실을 새로 지어내지 않는다. 기억은 흐려질 뿐, 자라지 않는다.
- 1인칭·시점·말투는 원문을 따른다.
- 출력은 다시 쓴 본문 텍스트만 — 설명·따옴표·머리말 없이.`, rewriteStrength(stage))
}

// rewriteStrength maps the abstraction stage to a verbal blur strength for the prompt. The
// enqueue gate guarantees stage ≥ rewrite.stage_threshold (2), so the default branch is stage 2.
func rewriteStrength(stage int) string {
	switch {
	case stage >= 4:
		return "기억이 많이 바랜 듯 강하게(세부가 거의 사라지고 인상·감정만 남게)"
	case stage == 3:
		return "꽤 흐릿하게(세부 상당수가 뭉개지고 요점 위주로)"
	default:
		return "아주 약간만 흐릿하게(큰 줄기는 또렷이 두고 표현만 미세하게)"
	}
}

// SwitchingRewriter is the admin-controlled rewriter (spec 34, mirrors SwitchingExtractor):
// each call asks the ConfigSource whether an LLM selection is ACTIVE and routes to the real
// LLM rewriter when it is, the no-op (no content change) when it isn't — so turning AI rewrite
// on/off is a console action, never an env change or a restart. The probe is cached under
// switchTTL; a broken source keeps the last known route (never blanks a rewrite path).
type SwitchingRewriter struct {
	src  llm.ConfigSource
	llm  Rewriter
	noop Rewriter

	mu        sync.Mutex
	active    bool
	expiresAt time.Time
}

// NewSwitchingRewriter wires the admin-followed switch over the LLM + no-op adapters.
func NewSwitchingRewriter(src llm.ConfigSource, llmRewriter, noop Rewriter) *SwitchingRewriter {
	return &SwitchingRewriter{src: src, llm: llmRewriter, noop: noop}
}

func (s *SwitchingRewriter) Rewrite(ctx context.Context, text string, stage int) (string, error) {
	if s.llmActive(ctx) {
		return s.llm.Rewrite(ctx, text, stage)
	}
	return s.noop.Rewrite(ctx, text, stage)
}

// llmActive reports whether the admin console has an active LLM selection, re-reading the
// source at most once per switchTTL (shared with SwitchingExtractor). The decrypted key is
// discarded here — the resolver behind the LLM rewriter does its own read.
func (s *SwitchingRewriter) llmActive(ctx context.Context) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if now.Before(s.expiresAt) {
		return s.active
	}
	_, _, _, ok, err := s.src.ActiveLLM(ctx)
	s.expiresAt = now.Add(switchTTL)
	if err != nil {
		// DB down / undecryptable key: keep the last known route — flapping to no-op on a
		// transient outage would silently stop rewrites mid-session.
		slog.Warn("switching rewriter: config source failed; keeping last route", "active", s.active, "err", err)
		return s.active
	}
	s.active = ok
	return s.active
}
