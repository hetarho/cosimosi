package pg

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// statementCounter is a pgx tracer that records every statement issued while it is counting,
// keyed by the sqlc query name (or the raw text for begin/commit and friends).
type statementCounter struct {
	mu       sync.Mutex
	counting bool
	byName   map[string]int
	total    int
}

func (c *statementCounter) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.counting {
		c.total++
		c.byName[statementName(data.SQL)]++
	}
	return ctx
}

func (*statementCounter) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func (c *statementCounter) count(t *testing.T, run func() error) (int, map[string]int) {
	t.Helper()
	c.mu.Lock()
	c.counting, c.byName, c.total = true, map[string]int{}, 0
	c.mu.Unlock()
	err := run()
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counting = false
	if err != nil {
		t.Fatalf("counted run failed: %v", err)
	}
	return c.total, c.byName
}

func statementName(sql string) string {
	if rest, ok := strings.CutPrefix(strings.TrimSpace(sql), "-- name: "); ok {
		name, _, _ := strings.Cut(rest, " ")
		return name
	}
	return strings.ToLower(strings.TrimSpace(sql))
}

func openTracedMemoryPool(t *testing.T) (*pgxpool.Pool, *statementCounter) {
	t.Helper()
	base := openMemoryTestPool(t)
	config, err := pgxpool.ParseConfig(base.PgxPool().Config().ConnString())
	if err != nil {
		t.Fatalf("ParseConfig failed: %v", err)
	}
	counter := &statementCounter{byName: map[string]int{}}
	config.ConnConfig.Tracer = counter
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("NewWithConfig failed: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool, counter
}

// seedGraph writes, in a handful of set-based statements, `memories` memories born on day with a full
// gist ladder and their gist timer at timerResetAt, two fresh neurons per memory wired by one
// synapse, and the universe clock at clock.
func seedGraph(t *testing.T, ctx context.Context, pool *pgxpool.Pool, scope platform.UserScope, prefix string, memories int, day time.Time, timerResetAt time.Time, clock time.Time) {
	t.Helper()
	emotion, _ := memory.NewEmotion(memory.MoodNeutral)
	statements := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO diaries (id, user_id, body, diary_date, created_at) VALUES ($1, $2, 'seed diary', $3, now())`,
			[]any{prefix + "-diary", scope.UserID(), day}},
		{`INSERT INTO episodic_memories (id, user_id, diary_id, name, source_text, current_text, seed, mood, valence,
			arousal, intensity, base_strength, recall_count, created_universe_time, semantic_stage, semantic_stages,
			semanticize_timer_reset_at)
		  SELECT $1 || '-m' || g, $2, $1 || '-diary', 'seed ' || g, 'seed text ' || g,
			'I walked to the harbor and watched the boats until sunset came, time number ' || g, g, $3, $4, $5, $6,
			$7, 0, $8, 0, '["gist one", "gist two", "gist three", "gist four"]'::jsonb, $10
		  FROM generate_series(1, $9::int) AS g`,
			[]any{prefix, scope.UserID(), string(memory.MoodNeutral), emotion.Valence, emotion.Arousal, emotion.Intensity,
				memory.ArousalToInitialStrength(emotion.Arousal), day, memories, timerResetAt}},
		{`INSERT INTO neurons (id, user_id, name, neuron_type, created_at)
		  SELECT $1 || '-n' || g, $2, $1 || ' neuron ' || g, $3, now() FROM generate_series(1, $4::int) AS g`,
			[]any{prefix, scope.UserID(), string(memory.NeuronTypeSemantic), memories * 2}},
		{`INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight)
		  SELECT $1 || '-m' || ((g + 1) / 2), $1 || '-n' || g, $2, 1 FROM generate_series(1, $3::int) AS g`,
			[]any{prefix, scope.UserID(), memories * 2}},
		{`INSERT INTO synapses (id, user_id, neuron_a_id, neuron_b_id, strength, co_activation_count,
			last_activated_universe_time, created_at)
		  SELECT $1 || '-s' || g, $2, least($1 || '-n' || (2 * g - 1), $1 || '-n' || (2 * g)),
			greatest($1 || '-n' || (2 * g - 1), $1 || '-n' || (2 * g)), 0.5, 1, $3, now()
		  FROM generate_series(1, $4::int) AS g`,
			[]any{prefix, scope.UserID(), day, memories}},
	}
	for _, statement := range statements {
		if _, err := pool.Exec(ctx, statement.sql, statement.args...); err != nil {
			t.Fatalf("seed failed: %v\n%s", err, statement.sql)
		}
	}
	if _, err := NewStore(pool).AdvanceUniverseClock(ctx, scope, clock); err != nil {
		t.Fatalf("seed clock failed: %v", err)
	}
}

// A launch's statement count does not grow with the graph it lands in: every per-row write is a
// batch and the consolidation it triggers reads scalars, then texts in one statement.
func TestLaunchStatementCountIsIndependentOfGraphSize(t *testing.T) {
	pool, counter := openTracedMemoryPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	day := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	launchDay := day.AddDate(0, 0, 30)

	counts := map[int]int{}
	names := map[int]map[string]int{}
	for _, neurons := range []int{10, 100} {
		prefix := fmt.Sprintf("test-statements-%d-%d", neurons, time.Now().UnixNano())
		cleanupMemoryTestRows(t, openMemoryTestPool(t), prefix+"-user")
		scope, err := platform.NewUserScope(prefix + "-user")
		if err != nil {
			t.Fatalf("NewUserScope failed: %v", err)
		}
		seedGraph(t, ctx, pool, scope, prefix, neurons/2, day, day, day)

		services := newGraphServices(t, graphServiceDeps{
			store:       withEconomy(NewStore(pool), memory.NoEconomy{}),
			progression: memory.NewConsolidator(nil),
			now:         func() time.Time { return launchDay.Add(12 * time.Hour) },
		})
		confirmed := make([]memory.ExtractedMemory, 0, 5)
		body := ""
		for i := 1; i <= 5; i++ {
			text := fmt.Sprintf("scene %d by the water", i)
			body += text + ". "
			confirmed = append(confirmed, memory.ExtractedMemory{
				Name: fmt.Sprintf("scene %d", i), Mood: memory.MoodCalm, SourceText: text,
				Neurons: []memory.ExtractedNeuron{
					{Name: fmt.Sprintf("%s neuron %d", prefix, i), Type: memory.NeuronTypeSemantic},
					{Name: fmt.Sprintf("new place %d", i), Type: memory.NeuronTypeSemantic},
				},
			})
		}
		counts[neurons], names[neurons] = counter.count(t, func() error {
			_, err := services.PersistEncoded(ctx, scope, body, launchDay, confirmed)
			return err
		})
	}
	if counts[10] != counts[100] {
		t.Fatalf("a 5-memory launch issued %d statements over 10 neurons and %d over 100\n10: %v\n100: %v",
			counts[10], counts[100], names[10], names[100])
	}
}

// A user returning to 2,000 memories crosses a gist stage and a decay stage on every one of them;
// each batched write still issues at most ceil(2000 / persistence.graph_write_batch_size) statements.
func TestStageAdvanceBatchesItsWrites(t *testing.T) {
	pool, counter := openTracedMemoryPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	const memories = 2000
	prefix := fmt.Sprintf("test-statements-advance-%d", time.Now().UnixNano())
	cleanupMemoryTestRows(t, openMemoryTestPool(t), prefix+"-user")
	scope, err := platform.NewUserScope(prefix + "-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	day := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	// The one-day interval ending on the first day a forgetting stage is reached, with the gist timer
	// anchored so that the same day crosses exactly one gist unit: every memory then publishes one
	// provenance row, advances one stage and fills one decay text.
	emotion, _ := memory.NewEmotion(memory.MoodNeutral)
	strength := memory.EffectiveStrength(memory.ArousalToInitialStrength(emotion.Arousal), 0)
	to := day
	for memory.DecayStage(memory.EffectiveElapsedDays(to, nil, day, 0), emotion.Arousal, strength) < 1 {
		to = to.AddDate(0, 0, 1)
	}
	from := to.AddDate(0, 0, -1)
	anchor := to
	for memory.GistUnitsElapsed(to, anchor, emotion.Arousal, strength) < 1 {
		anchor = anchor.AddDate(0, 0, -1)
	}
	if units := memory.GistUnitsElapsed(to, anchor, emotion.Arousal, strength); units != 1 {
		t.Fatalf("fixture crosses %d gist units, want exactly one", units)
	}
	seedGraph(t, ctx, pool, scope, prefix, memories, day, anchor, from)

	store := withEconomy(NewStore(pool), memory.NoEconomy{})
	_, byName := counter.count(t, func() error {
		return store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
			if err := tx.LockGraphMutation(ctx, scope); err != nil {
				return err
			}
			if _, err := tx.AdvanceUniverseClock(ctx, scope, to); err != nil {
				return err
			}
			return memory.NewConsolidator(nil).OnAdvance(ctx, scope, tx, &from, to)
		})
	})
	ceiling := (memories + values.PersistenceGraphWriteBatchSize - 1) / values.PersistenceGraphWriteBatchSize
	for _, write := range []string{"AppendMemoryProvenances", "ApplyConsolidationStageAdvances", "FillConsolidationDecayStages"} {
		if got := byName[write]; got == 0 || got > ceiling {
			t.Errorf("%s issued %d statements for %d memories, want 1..%d", write, got, memories, ceiling)
		}
	}
	if got := byName["ListConsolidationTexts"]; got != 1 {
		t.Errorf("texts were read in %d statements, want one", got)
	}
	var provenance, filled int
	if err := pool.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM memory_provenance WHERE user_id = $1),
		(SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND decay_stages IS NOT NULL)`,
		scope.UserID()).Scan(&provenance, &filled); err != nil {
		t.Fatalf("read effects failed: %v", err)
	}
	if provenance != memories || filled != memories {
		t.Fatalf("advance wrote %d provenance rows and %d decay fills, want %d each", provenance, filled, memories)
	}
}
