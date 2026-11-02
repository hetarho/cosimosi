package db

import (
	"context"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// writeCountingConn counts client writes: pgx flushes once per round trip.
type writeCountingConn struct {
	net.Conn
	writes *atomic.Int64
}

func (c writeCountingConn) Write(b []byte) (int, error) {
	c.writes.Add(1)
	return c.Conn.Write(b)
}

// DATABASE_URL's default_query_exec_mode=cache_describe (DEPLOY.md) executes a statement in one round
// trip once its description is cached on the connection; describe_exec, the previous setting, always
// took two.
func TestCacheDescribeExecutesInOneRoundTripAfterTheFirst(t *testing.T) {
	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	separator := "?"
	if strings.Contains(url, "?") {
		separator = "&"
	}
	for mode, roundTrips := range map[string]int64{"cache_describe": 1, "describe_exec": 2} {
		config, err := pgx.ParseConfig(url + separator + "default_query_exec_mode=" + mode)
		if err != nil {
			t.Fatalf("ParseConfig(%s): %v", mode, err)
		}
		var writes atomic.Int64
		dialer := &net.Dialer{}
		config.DialFunc = func(ctx context.Context, network, address string) (net.Conn, error) {
			conn, err := dialer.DialContext(ctx, network, address)
			if err != nil {
				return nil, err
			}
			return writeCountingConn{Conn: conn, writes: &writes}, nil
		}
		conn, err := pgx.ConnectConfig(ctx, config)
		if err != nil {
			t.Fatalf("connect(%s): %v", mode, err)
		}
		exec := func() {
			if _, err := conn.Exec(ctx, "SELECT $1::int", 1); err != nil {
				t.Fatalf("exec(%s): %v", mode, err)
			}
		}
		exec()
		writes.Store(0)
		for range 3 {
			exec()
		}
		got := writes.Load()
		_ = conn.Close(ctx)
		if got != 3*roundTrips {
			t.Fatalf("%s: 3 warm execs took %d round trips, want %d", mode, got, 3*roundTrips)
		}
	}
}
