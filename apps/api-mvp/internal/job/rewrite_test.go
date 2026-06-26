package job

import (
	"context"
	"log/slog"
	"testing"

	"github.com/cosimosi/backend/internal/ai"
)

// rewriteStore overrides the two rewrite GraphStore methods (inheriting the rest from
// stubStore) so a handleRewrite test can feed an input and capture whether ApplyRewrite ran.
type rewriteStore struct {
	stubStore
	in      RewriteInput
	applied string // captured content; "" = ApplyRewrite was NOT called (no-op)
}

func (r *rewriteStore) GetRewriteInput(context.Context, string) (RewriteInput, error) {
	return r.in, nil
}
func (r *rewriteStore) ApplyRewrite(_ context.Context, _, _, _, content string) error {
	r.applied = content
	return nil
}

// stubRewriter returns a fixed output (and optional error) regardless of input.
type stubRewriter struct {
	out string
	err error
}

func (s stubRewriter) Rewrite(context.Context, string, int) (string, error) { return s.out, s.err }

// handleRewrite applies the variant ONLY when the text actually changed; an unchanged result
// (AI off / unusable output) is a graceful no-op — no ApplyRewrite, job still completes (spec 54 A5).
func TestHandleRewriteAppliesOnlyWhenChanged(t *testing.T) {
	ctx := context.Background()
	log := slog.New(slog.DiscardHandler)

	t.Run("changed → ApplyRewrite with the new text", func(t *testing.T) {
		store := &rewriteStore{in: RewriteInput{UserID: "u", Text: "original", AbstractionStage: 3}}
		w := NewWorker(&stubJobs{}, store, panicEmbedder{}, ai.NoopExtractor{}, stubRewriter{out: "blurred"}, log)
		if err := w.handleRewrite(ctx, Job{Kind: KindRewrite, MemoryID: "m"}); err != nil {
			t.Fatalf("handleRewrite: %v", err)
		}
		if store.applied != "blurred" {
			t.Fatalf("applied = %q, want %q", store.applied, "blurred")
		}
	})

	t.Run("unchanged → graceful no-op (no ApplyRewrite)", func(t *testing.T) {
		store := &rewriteStore{in: RewriteInput{UserID: "u", Text: "original", AbstractionStage: 2}}
		w := NewWorker(&stubJobs{}, store, panicEmbedder{}, ai.NoopExtractor{}, stubRewriter{out: "original"}, log)
		if err := w.handleRewrite(ctx, Job{Kind: KindRewrite, MemoryID: "m"}); err != nil {
			t.Fatalf("handleRewrite: %v", err)
		}
		if store.applied != "" {
			t.Fatalf("no-op should not ApplyRewrite, applied = %q", store.applied)
		}
	})

	t.Run("NoopRewriter (AI off) → no-op", func(t *testing.T) {
		store := &rewriteStore{in: RewriteInput{UserID: "u", Text: "original", AbstractionStage: 4}}
		w := NewWorker(&stubJobs{}, store, panicEmbedder{}, ai.NoopExtractor{}, ai.NoopRewriter{}, log)
		if err := w.handleRewrite(ctx, Job{Kind: KindRewrite, MemoryID: "m"}); err != nil {
			t.Fatalf("handleRewrite: %v", err)
		}
		if store.applied != "" {
			t.Fatalf("noop rewriter should not ApplyRewrite, applied = %q", store.applied)
		}
	})
}
