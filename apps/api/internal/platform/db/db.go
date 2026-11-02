package db

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const EnvDatabaseURL = "DATABASE_URL"

var ErrDatabaseURLRequired = errors.New("database url is required")
var ErrPoolNotOpen = errors.New("database pool is not open")

// Config opens one pool. MaxConns and MaxConnLifetimeJitter are the composition root's deployment
// budget; a value the URL already sets (pool_max_conns, pool_max_conn_lifetime_jitter) wins, so an
// operator can still override a deployment through its DSN.
type Config struct {
	URL                   string
	MaxConns              int32
	MaxConnLifetimeJitter time.Duration
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
	if cfg.MaxConns > 0 && !strings.Contains(url, "pool_max_conns=") {
		poolConfig.MaxConns = cfg.MaxConns
	}
	if cfg.MaxConnLifetimeJitter > 0 && !strings.Contains(url, "pool_max_conn_lifetime_jitter=") {
		poolConfig.MaxConnLifetimeJitter = cfg.MaxConnLifetimeJitter
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

// MaxConns reports the pool's connection ceiling.
func (p *Pool) MaxConns() int32 {
	pool, err := p.ready()
	if err != nil {
		return 0
	}
	return pool.Config().MaxConns
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
