package db

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/jackc/pgx/v5"
)

func TestConfigFromEnvRequiresDatabaseURL(t *testing.T) {
	t.Setenv(EnvDatabaseURL, "")

	if _, err := ConfigFromEnv(); !errors.Is(err, ErrDatabaseURLRequired) {
		t.Fatalf("ConfigFromEnv error = %v, want ErrDatabaseURLRequired", err)
	}
}

func TestOpenPingCloseWithPgvector(t *testing.T) {
	t.Parallel()

	pool := openTestPool(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("Ping failed: %v", err)
	}

	var version string
	if err := pool.PgxPool().QueryRow(ctx, "select extversion::text from pg_extension where extname = 'vector'").Scan(&version); err != nil {
		t.Fatalf("pgvector extension check failed: %v", err)
	}
	if version == "" {
		t.Fatal("pgvector extension version is empty")
	}

	if got, err := dbgen.New(pool.PgxPool()).PingDatabase(ctx); err != nil || got != 1 {
		t.Fatalf("sqlc PingDatabase = %d, %v; want 1, nil", got, err)
	}
}

func TestInTxCommitsWork(t *testing.T) {
	t.Parallel()

	pool := openTestPool(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := pool.InTx(ctx, func(ctx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "select 1")
		return err
	}); err != nil {
		t.Fatalf("InTx failed: %v", err)
	}
}

func openTestPool(t *testing.T) *Pool {
	t.Helper()

	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := Open(ctx, Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	return pool
}
