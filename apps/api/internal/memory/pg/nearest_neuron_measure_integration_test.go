package pg

import (
	"context"
	"fmt"
	"math"
	"math/rand/v2"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// envMeasureNearest opts into the nearest-neuron measurement: it seeds 50,000 embeddings into the
// test launcher's isolated database and takes minutes, so it never runs in the ordinary suite.
const envMeasureNearest = "COSIMOSI_MEASURE_NEAREST"

const (
	measureUsers   = 100
	measureNeurons = 500
	// Every user names the same 500 concepts — the way real users share "mom", "coffee" or "work" —
	// so the same name embeds to the same vector in every user's graph. That is the case a global
	// index filtered to one user gets wrong.
	measureConcepts = 500
)

// exactNearestQuery restricts to the user before ordering, so no global index can be used.
const exactNearestQuery = `WITH own AS MATERIALIZED (
    SELECT e.neuron_id, e.vector FROM embeddings AS e WHERE e.user_id = $1
)
SELECT n.id
FROM own
JOIN neurons AS n ON n.user_id = $1 AND n.id = own.neuron_id
WHERE n.sealed_at IS NULL
  AND n.name IS NOT NULL
  AND (1 - (own.vector <=> $2::vector)) >= $3::float8
ORDER BY own.vector <=> $2::vector
LIMIT $4`

// currentNearestQuery is ListNearestNeuronCandidates as shipped.
const currentNearestQuery = `SELECT n.id
FROM embeddings AS e
JOIN neurons AS n
  ON n.user_id = e.user_id
 AND n.id = e.neuron_id
WHERE e.user_id = $1
  AND n.sealed_at IS NULL
  AND n.name IS NOT NULL
  AND (1 - (e.vector <=> $2::vector)) >= $3::float8
ORDER BY e.vector <=> $2::vector
LIMIT $4`

func TestMeasureNearestNeuronCandidates(t *testing.T) {
	if os.Getenv(envMeasureNearest) == "" {
		t.Skipf("set %s=1 to run the nearest-neuron measurement", envMeasureNearest)
	}
	pool := openMemoryTestPool(t).PgxPool()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()

	var version string
	if err := pool.QueryRow(ctx, `SELECT extversion FROM pg_extension WHERE extname = 'vector'`).Scan(&version); err != nil {
		t.Fatalf("read pgvector version: %v", err)
	}
	t.Logf("pgvector %s, %d users × %d neurons over %d shared concepts, dim %d", version, measureUsers, measureNeurons, measureConcepts, values.AiEmbeddingDim)

	prefix := fmt.Sprintf("measure-%d", time.Now().UnixNano())
	concepts := seedSharedConcepts(t, ctx, pool, prefix)

	rng := rand.New(rand.NewPCG(7, 11))
	type probe struct {
		userID   string
		neuronID string
		vector   string
	}
	probes := make([]probe, 0, measureUsers)
	for user := 1; user <= measureUsers; user++ {
		neuron := 1 + rng.IntN(measureNeurons)
		probes = append(probes, probe{
			userID:   fmt.Sprintf("%s-u%d", prefix, user),
			neuronID: fmt.Sprintf("%s-u%d-n%d", prefix, user, neuron),
			vector:   concepts[conceptOf(user, neuron)],
		})
	}

	measure := func(name string, run func(probe) ([]string, error)) {
		t.Helper()
		hits := 0
		durations := make([]time.Duration, 0, len(probes))
		for _, p := range probes {
			start := time.Now()
			ids, err := run(p)
			durations = append(durations, time.Since(start))
			if err != nil {
				t.Fatalf("%s: %v", name, err)
			}
			if len(ids) > 0 && ids[0] == p.neuronID {
				hits++
			}
		}
		slices.Sort(durations)
		t.Logf("%-28s own top-1 recall %3d/%d  p50 %7.2fms  p95 %7.2fms", name, hits, len(probes),
			ms(durations[len(durations)/2]), ms(durations[len(durations)*95/100]))
	}
	query := func(sql string, setup string) func(probe) ([]string, error) {
		return func(p probe) ([]string, error) {
			tx, err := pool.Begin(ctx)
			if err != nil {
				return nil, err
			}
			defer func() { _ = tx.Rollback(ctx) }()
			if setup != "" {
				if _, err := tx.Exec(ctx, setup); err != nil {
					return nil, err
				}
			}
			rows, err := tx.Query(ctx, sql, p.userID, p.vector, values.EncodeDedupSimilarityThreshold, int32(values.EncodeDedupTopK))
			if err != nil {
				return nil, err
			}
			return pgx.CollectRows(rows, pgx.RowTo[string])
		}
	}

	store := NewStore(pool)
	measure("(a) current query", func(p probe) ([]string, error) {
		scope, err := platform.NewUserScope(p.userID)
		if err != nil {
			return nil, err
		}
		vector, err := parseVector(p.vector)
		if err != nil {
			return nil, err
		}
		neurons, err := store.ListNearestNeuronCandidates(ctx, scope, vector, values.EncodeDedupSimilarityThreshold, int32(values.EncodeDedupTopK))
		ids := make([]string, 0, len(neurons))
		for _, neuron := range neurons {
			ids = append(ids, neuron.ID)
		}
		return ids, err
	})
	measure("(b) exact per-user scan", query(exactNearestQuery, ""))
	measure("(c) iterative relaxed_order", query(currentNearestQuery, "SET LOCAL hnsw.iterative_scan = relaxed_order"))
	measure("(d) no global index", query(currentNearestQuery, "SET LOCAL enable_indexscan = off"))

	for name, sql := range map[string]string{"current": currentNearestQuery, "exact": exactNearestQuery} {
		rows, err := pool.Query(ctx, "EXPLAIN (ANALYZE, BUFFERS) "+sql, probes[0].userID, probes[0].vector,
			values.EncodeDedupSimilarityThreshold, int32(values.EncodeDedupTopK))
		if err != nil {
			t.Fatalf("explain %s: %v", name, err)
		}
		plan, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			t.Fatalf("explain %s: %v", name, err)
		}
		t.Logf("EXPLAIN ANALYZE %s:\n%s", name, strings.Join(plan, "\n"))
	}
}

// conceptOf is the shared concept a user's neuron names.
func conceptOf(user int, neuron int) int {
	return (neuron + user*7) % measureConcepts
}

func seedSharedConcepts(t *testing.T, ctx context.Context, pool *pgxpool.Pool, prefix string) []string {
	t.Helper()
	rng := rand.New(rand.NewPCG(1, 2))
	concepts := make([]string, measureConcepts)
	for i := range concepts {
		concepts[i] = randomUnitVector(rng, values.AiEmbeddingDim)
	}
	start := time.Now()
	// Temp tables are per connection, so the seed runs on one acquired connection throughout.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, `CREATE TEMP TABLE IF NOT EXISTS measure_concepts (id int PRIMARY KEY, v vector(1024))`); err != nil {
		t.Fatalf("concept table: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO measure_concepts (id, v) SELECT concept.ordinality - 1, concept.value::vector FROM unnest($1::text[]) WITH ORDINALITY AS concept(value, ordinality)`, concepts); err != nil {
		t.Fatalf("insert concepts: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO neurons (id, user_id, name, neuron_type, created_at)
		SELECT format('%s-u%s-n%s', $1::text, u, n), format('%s-u%s', $1::text, u), format('concept %s', (n + u * 7) % $2::int),
			'semantic', now()
		FROM generate_series(1, $3::int) AS u, generate_series(1, $4::int) AS n`,
		prefix, measureConcepts, measureUsers, measureNeurons); err != nil {
		t.Fatalf("insert neurons: %v", err)
	}
	if _, err := conn.Exec(ctx, `INSERT INTO embeddings (neuron_id, user_id, vector)
		SELECT format('%s-u%s-n%s', $1::text, u, n), format('%s-u%s', $1::text, u), c.v
		FROM generate_series(1, $2::int) AS u
		CROSS JOIN generate_series(1, $3::int) AS n
		JOIN measure_concepts AS c ON c.id = (n + u * 7) % $4::int`,
		prefix, measureUsers, measureNeurons, measureConcepts); err != nil {
		t.Fatalf("insert embeddings: %v", err)
	}
	for _, table := range []string{"embeddings", "neurons"} {
		if _, err := conn.Exec(ctx, "ANALYZE "+table); err != nil {
			t.Fatalf("analyze %s: %v", table, err)
		}
	}
	t.Logf("seeded %d embeddings in %s", measureUsers*measureNeurons, time.Since(start).Round(time.Second))
	return concepts
}

func randomUnitVector(rng *rand.Rand, dim int) string {
	values := make([]float64, dim)
	norm := 0.0
	for i := range values {
		values[i] = rng.NormFloat64()
		norm += values[i] * values[i]
	}
	norm = math.Sqrt(norm)
	parts := make([]string, dim)
	for i, value := range values {
		parts[i] = fmt.Sprintf("%.6f", value/norm)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func parseVector(literal string) ([]float32, error) {
	fields := strings.Split(strings.Trim(literal, "[]"), ",")
	vector := make([]float32, len(fields))
	for i, field := range fields {
		var value float64
		if _, err := fmt.Sscan(field, &value); err != nil {
			return nil, err
		}
		vector[i] = float32(value)
	}
	return vector, nil
}

func ms(duration time.Duration) float64 {
	return float64(duration.Microseconds()) / 1000
}
