package db

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const EnvDatabaseURL = "DATABASE_URL"

var ErrDatabaseURLRequired = errors.New("database url is required")
var ErrPoolNotOpen = errors.New("database pool is not open")

type Config struct {
	URL string
}

type Pool struct {
	pool *pgxpool.Pool
}

func ConfigFromEnv() (Config, error) {
	url := strings.TrimSpace(os.Getenv(EnvDatabaseURL))
	if url == "" {
		return Config{}, ErrDatabaseURLRequired
	}
	return Config{URL: url}, nil
}

func Open(ctx context.Context, cfg Config) (*Pool, error) {
	url := strings.TrimSpace(cfg.URL)
	if url == "" {
		return nil, ErrDatabaseURLRequired
	}
	poolConfig, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, err
	}
	return &Pool{pool: pool}, nil
}

func (p *Pool) Ping(ctx context.Context) error {
	pool, err := p.ready()
	if err != nil {
		return err
	}
	return pool.Ping(ctx)
}

func (p *Pool) Close() {
	if p != nil && p.pool != nil {
		p.pool.Close()
	}
}

func (p *Pool) PgxPool() *pgxpool.Pool {
	pool, err := p.ready()
	if err != nil {
		return nil
	}
	return pool
}

func (p *Pool) InTx(ctx context.Context, fn func(context.Context, pgx.Tx) error) error {
	pool, err := p.ready()
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *Pool) ready() (*pgxpool.Pool, error) {
	if p == nil || p.pool == nil {
		return nil, ErrPoolNotOpen
	}
	return p.pool, nil
}
