package pg

import (
	"context"
	"testing"
	"time"
)

// Every foreign key needs an index the referential check can use, or each parent delete scans the
// whole child table across every user. An index serves a key when its first column is one of the
// key's columns and is not user_id, or when its first two columns are both key columns: a lone
// leading user_id narrows the check only to one user's rows.
func TestProductForeignKeysHaveLeadingIndexes(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := pool.PgxPool().Query(ctx, `
		WITH fk AS (
			SELECT c.conrelid, c.conname,
			       array_agg(a.attname ORDER BY a.attname) AS columns
			FROM pg_constraint c
			JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
			WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
			GROUP BY c.conrelid, c.conname
		), index_heads AS (
			SELECT i.indrelid,
			       (SELECT attname FROM pg_attribute WHERE attrelid = i.indrelid AND attnum = i.indkey[0]) AS first,
			       (SELECT attname FROM pg_attribute WHERE attrelid = i.indrelid AND attnum = i.indkey[1]) AS second
			FROM pg_index i
		)
		SELECT fk.conrelid::regclass::text, fk.conname
		FROM fk
		WHERE NOT EXISTS (
			SELECT 1 FROM index_heads l
			WHERE l.indrelid = fk.conrelid
			  AND l.first = ANY (fk.columns)
			  AND (l.first <> 'user_id' OR l.second = ANY (fk.columns))
		)
		ORDER BY 1, 2`)
	if err != nil {
		t.Fatalf("foreign key inventory failed: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var table, constraint string
		if err := rows.Scan(&table, &constraint); err != nil {
			t.Fatalf("scan failed: %v", err)
		}
		t.Errorf("%s.%s has no index its referential check can use", table, constraint)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("foreign key inventory failed: %v", err)
	}
}
