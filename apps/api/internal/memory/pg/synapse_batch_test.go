package pg

import (
	"context"
	"fmt"
	"testing"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5/pgconn"
)

type batchExecProbe struct {
	dbgen.DBTX
	counts []int
}

func (p *batchExecProbe) Exec(_ context.Context, _ string, args ...any) (pgconn.CommandTag, error) {
	p.counts = append(p.counts, len(args[1].([]string)))
	return pgconn.NewCommandTag("INSERT 0 1"), nil
}

func TestSynapseWritesUseBoundedBatchesAndValidateBeforeWriting(t *testing.T) {
	scope, err := platform.NewUserScope("owner")
	if err != nil {
		t.Fatal(err)
	}
	probe := &batchExecProbe{}
	store := NewReadStore(probe)
	n := values.PersistenceGraphWriteBatchSize*2 + 1
	rows := make([]memory.Synapse, n)
	for i := range rows {
		rows[i] = memory.Synapse{ID: fmt.Sprintf("s-%d", i), NeuronAID: "a", NeuronBID: fmt.Sprintf("b-%d", i), Strength: .5, CoActivationCount: 1}
	}
	if err := store.UpsertSynapses(context.Background(), scope, rows); err != nil {
		t.Fatal(err)
	}
	if len(probe.counts) != 3 || probe.counts[0] != values.PersistenceGraphWriteBatchSize || probe.counts[2] != 1 {
		t.Fatalf("batch sizes: %v", probe.counts)
	}
	probe.counts = nil
	rows[n-1].NeuronBID = "a"
	if err := store.UpsertSynapses(context.Background(), scope, rows); err == nil || len(probe.counts) != 0 {
		t.Fatalf("invalid tail wrote a partial batch: %v / %v", err, probe.counts)
	}
}
