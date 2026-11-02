package wiring

import (
	"context"
	"errors"
	"net/http"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/store"
)

// queriesDir holds one sqlc input directory per context that owns tables.
const queriesDir = "../../../db/queries"

// contextsWithoutPurgeLeg own query directories but no leg: account runs the sweep and deletes its
// own rows after every leg, admin holds operator config rather than per-user data, and platform's job
// queue rows are cancelled by the withdrawal scheduler and aged out by terminal cleanup.
var contextsWithoutPurgeLeg = []string{"account", "admin", "platform"}

// A context that gains per-user tables gains a query directory, and a sweep without its leg leaves
// that context's rows behind a hard-deleted account. This fails without a database when the leg list
// and the query directories disagree in either direction.
func TestPurgeLegsCoverEveryContextOwningUserRows(t *testing.T) {
	t.Parallel()
	entries, err := os.ReadDir(queriesDir)
	if err != nil {
		t.Fatalf("read %s: %v", queriesDir, err)
	}
	var want []string
	for _, entry := range entries {
		if entry.IsDir() && !slices.Contains(contextsWithoutPurgeLeg, entry.Name()) {
			want = append(want, entry.Name())
		}
	}
	var got []string
	for _, leg := range PurgeLegs(nil) {
		got = append(got, leg.PurgeName())
	}
	slices.Sort(want)
	sorted := slices.Sorted(slices.Values(got))
	if !slices.Equal(sorted, want) {
		t.Fatalf("purge legs = %v, want one per context owning user rows %v", got, want)
	}
	if len(slices.Compact(sorted)) != len(got) {
		t.Fatalf("purge legs name a context twice: %v", got)
	}
}

func TestAccountDirectoryRefusesTheFakeOnlyInProduction(t *testing.T) {
	t.Setenv(envSupabaseProjectURL, "")
	t.Setenv(envSupabaseURL, "")
	t.Setenv(envSupabaseServiceRoleKey, "")

	t.Setenv(apperr.EnvDeployEnvironment, "production")
	if _, err := AccountDirectory(http.DefaultClient); !errors.Is(err, ErrProductionDirectoryRequired) {
		t.Fatalf("production without credentials err = %v, want ErrProductionDirectoryRequired", err)
	}

	t.Setenv(apperr.EnvDeployEnvironment, "")
	directory, err := AccountDirectory(http.DefaultClient)
	if err != nil {
		t.Fatalf("development without credentials failed: %v", err)
	}
	if _, ok := directory.(platformsupabase.Fake); !ok {
		t.Fatalf("development directory = %T, want the fake", directory)
	}

	t.Setenv(apperr.EnvDeployEnvironment, "production")
	t.Setenv(envSupabaseURL, "https://example.supabase.co")
	t.Setenv(envSupabaseServiceRoleKey, "server-only-test-key")
	directory, err = AccountDirectory(http.DefaultClient)
	if err != nil {
		t.Fatalf("production with credentials failed: %v", err)
	}
	if !platformsupabase.CredentialMutationsAvailable(directory) {
		t.Fatalf("production directory = %T, want the Admin API directory", directory)
	}
}

func TestFailClosedBindingsRefuse(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	scope, err := platform.NewUserScope("worker-probe-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	_, quoteErr := noSpendSignals{}.RecallAccessibility(ctx, scope, "m1")
	_, diaryQuoteErr := noSpendSignals{}.DiaryRecallAccessibilities(ctx, scope, "d1")
	_, gistQuoteErr := noSpendSignals{}.ViewableGistStage(ctx, scope, "m1")
	for name, check := range map[string]struct{ got, want error }{
		"invite":     {noInviteGranter{}.Grant(ctx, scope, "token"), ErrInviteSettlementUnavailable},
		"signup":     {noSignupBonusGranter{}.Grant(ctx, scope), ErrSignupBonusUnavailable},
		"progress":   {noAccountProgress{}.RecordProgress(ctx, scope, "invite_settled", 1), ErrProgressRecordingUnavailable},
		"quote":      {quoteErr, ErrSpendQuotingUnavailable},
		"diaryQuote": {diaryQuoteErr, ErrSpendQuotingUnavailable},
		"gistQuote":  {gistQuoteErr, ErrSpendQuotingUnavailable},
		"claim":      {noSettlementScheduler{}.ScheduleSettlement(ctx, scope, nil, "a1"), ErrClaimSchedulingUnavailable},
		"purchase":   {settleStoreTransaction{}.SpendPurchase(ctx, scope, store.PurchaseSpend{}), ErrPurchaseUnavailable},
	} {
		if !errors.Is(check.got, check.want) {
			t.Errorf("%s binding err = %v, want %v", name, check.got, check.want)
		}
	}
}

type stubEmbedder struct{}

func (stubEmbedder) Embed(context.Context, []string) ([][]float32, error) { return nil, nil }

type stubSemanticizer struct{}

func (stubSemanticizer) GenerateSemanticStages(context.Context, memory.SemanticizeMemory) (memory.SemanticStages, error) {
	return memory.SemanticStages{}, nil
}

type stubSweeper struct{}

func (stubSweeper) SweepWithdrawnAccount(context.Context, platform.UserScope, time.Time) error {
	return nil
}

type stubSettler struct{}

func (stubSettler) SettleClaims(context.Context, platform.UserScope) error { return nil }

// Persisted job rows name their kind by string, so the worker must register every kind a producer
// enqueues; the ones that are the only trigger for an effect the user cannot request again retry
// forever rather than dead-lettering.
func TestJobRegistrationsCoverEveryProducer(t *testing.T) {
	t.Parallel()
	memoryStore := memorypg.NewStore(nil)
	registrations, err := jobRegistrations(memory.JobDeps{
		Embedder:             stubEmbedder{},
		Semanticizer:         stubSemanticizer{},
		Sources:              memoryStore,
		EmbeddingWriter:      memoryStore,
		SemanticStagesWriter: memoryStore,
		Releases:             memoryStore,
	}, stubSweeper{}, stubSettler{})
	if err != nil {
		t.Fatalf("jobRegistrations failed: %v", err)
	}
	retryForever := map[string]bool{
		string(memory.JobKindEmbed):           false,
		string(memory.JobKindSemanticize):     false,
		string(memory.JobKindConsolidate):     false,
		string(memory.JobKindRetention):       true,
		string(account.WithdrawalJobKind):     true,
		string(achievement.SettlementJobKind): true,
	}
	if len(registrations) != len(retryForever) {
		t.Fatalf("registered kinds = %d, want %d", len(registrations), len(retryForever))
	}
	for kind, want := range retryForever {
		registration, ok := registrations[kind]
		if !ok {
			t.Fatalf("kind %q is not registered", kind)
		}
		if registration.RetryForever != want {
			t.Errorf("kind %q RetryForever = %v, want %v", kind, registration.RetryForever, want)
		}
	}
}
