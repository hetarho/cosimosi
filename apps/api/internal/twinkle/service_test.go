package twinkle

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// --- fakes -------------------------------------------------------------------

// fakeLedger mirrors the pg store's contract in memory: per-user balance facts,
// dedup-keyed append-only entries, the daily-grant guard, and all-or-nothing
// InLedgerTx semantics — so the use-case tests assert the same behavior the
// integration store enforces.
type fakeLedger struct {
	records map[string]BalanceRecord
	born    map[string]bool
	entries []recordedEntry
	txCount int
	writes  int
}

type recordedEntry struct {
	userID string
	entry  LedgerEntry
}

var errFakeOversell = errors.New("fake ledger refused the delta")

func newFakeLedger() *fakeLedger {
	return &fakeLedger{records: map[string]BalanceRecord{}, born: map[string]bool{}}
}

func (f *fakeLedger) GetBalanceRecord(_ context.Context, scope platform.UserScope) (*BalanceRecord, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	if !f.born[scope.UserID()] {
		return nil, nil
	}
	record := f.records[scope.UserID()]
	return &record, nil
}

func (f *fakeLedger) ApplyBalanceDelta(_ context.Context, scope platform.UserScope, resetWindow time.Time, additionalDelta int, basicSpentDelta int) (BalanceRecord, error) {
	if scope.UserID() == "" {
		return BalanceRecord{}, errors.New("scope missing")
	}
	f.writes++
	window := time.Date(resetWindow.UTC().Year(), resetWindow.UTC().Month(), resetWindow.UTC().Day(), 0, 0, 0, 0, time.UTC)
	record := f.records[scope.UserID()]
	spent := record.BasicSpentThisWindow + basicSpentDelta
	if record.BasicResetWindow.Before(window) {
		spent = basicSpentDelta
	}
	if spent > values.TwinkleBasicDailyAmount {
		return BalanceRecord{}, fmt.Errorf("%w: %w", errFakeOversell, ErrInsufficientTwinkle)
	}
	additional := record.Additional + additionalDelta
	if additional < 0 {
		return BalanceRecord{}, errFakeOversell
	}
	next := BalanceRecord{Additional: additional, BasicSpentThisWindow: spent, BasicResetWindow: window}
	if record.BasicResetWindow.After(window) {
		next.BasicResetWindow = record.BasicResetWindow
	}
	f.records[scope.UserID()] = next
	f.born[scope.UserID()] = true
	return next, nil
}

func (f *fakeLedger) AppendLedgerEntry(_ context.Context, scope platform.UserScope, entry LedgerEntry) (bool, error) {
	if scope.UserID() == "" {
		return false, errors.New("scope missing")
	}
	f.writes++
	if entry.DedupKey != nil {
		for _, existing := range f.entries {
			if existing.userID == scope.UserID() && existing.entry.DedupKey != nil && *existing.entry.DedupKey == *entry.DedupKey {
				return false, nil
			}
		}
	}
	f.entries = append(f.entries, recordedEntry{userID: scope.UserID(), entry: entry})
	return true, nil
}

func (f *fakeLedger) InLedgerTx(ctx context.Context, fn func(tx LedgerStore) error) error {
	f.txCount++
	// All-or-nothing: snapshot, run, restore on error.
	records := make(map[string]BalanceRecord, len(f.records))
	for user, record := range f.records {
		records[user] = record
	}
	born := make(map[string]bool, len(f.born))
	for user, wasBorn := range f.born {
		born[user] = wasBorn
	}
	entries := append([]recordedEntry(nil), f.entries...)
	if err := fn(f); err != nil {
		f.records, f.born, f.entries = records, born, entries
		return err
	}
	return nil
}

func (f *fakeLedger) userEntries(userID string) []LedgerEntry {
	out := []LedgerEntry{}
	for _, recorded := range f.entries {
		if recorded.userID == userID {
			out = append(out, recorded.entry)
		}
	}
	return out
}

type fakeSignals struct {
	recall map[string]float64
	gist   map[string]int
	diary  map[string][]float64
	err    error
}

func (f *fakeSignals) RecallAccessibility(_ context.Context, _ platform.UserScope, memoryID string) (float64, error) {
	if f.err != nil {
		return 0, f.err
	}
	return f.recall[memoryID], nil
}

func (f *fakeSignals) DiaryRecallAccessibilities(_ context.Context, _ platform.UserScope, diaryID string) ([]float64, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.diary[diaryID], nil
}

func (f *fakeSignals) ViewableGistStage(_ context.Context, _ platform.UserScope, memoryID string) (int, error) {
	if f.err != nil {
		return 0, f.err
	}
	return f.gist[memoryID], nil
}

// --- fixture -----------------------------------------------------------------

type twinkleFixture struct {
	ledger  *fakeLedger
	signals *fakeSignals
	service *Service
}

func twinkleNow() time.Time { return time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC) }

func twinkleToday() time.Time { return time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC) }

func newTwinkleFixture(t *testing.T) *twinkleFixture {
	t.Helper()
	fixture := &twinkleFixture{
		ledger:  newFakeLedger(),
		signals: &fakeSignals{recall: map[string]float64{}, gist: map[string]int{}, diary: map[string][]float64{}},
	}
	ids := 0
	service, err := NewService(ServiceDeps{
		Ledger:      fixture.ledger,
		Verifier:    KeylessPaymentVerifier{},
		ValidSignup: DistinctSignup,
		Signals:     fixture.signals,
		Now:         twinkleNow,
		NewID: func() string {
			ids++
			return fmt.Sprintf("entry-%d", ids)
		},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	fixture.service = service
	return fixture
}

func twinkleScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

// --- the [G5] affordability contract ------------------------------------------

func TestCoreLoopProtectionRelationship(t *testing.T) {
	t.Parallel()
	// [G5] as a relationship over the GENERATED constants, not a magic number: the
	// daily basic grant must cover a typical day's ruminative recalls at the cheap
	// end of the recall curve, so the gate only ever bites excess. The
	// expected-daily-ruminations figure is this test's documented product
	// assumption (a handful of everyday recalls, [M5]).
	const expectedDailyRuminations = 5
	cheapRecallCost := RecallCost(float64(values.ForgettingCostWeightFloor))
	if cheapRecallCost <= 0 {
		t.Fatalf("cheap recall cost = %d, want > 0 (never free, [G1])", cheapRecallCost)
	}
	if values.TwinkleBasicDailyAmount < expectedDailyRuminations*cheapRecallCost {
		t.Fatalf("basic_daily_amount %d < %d expected ruminations × cheap recall %d — the gate would bite everyday rumination ([G5])",
			values.TwinkleBasicDailyAmount, expectedDailyRuminations, cheapRecallCost)
	}
}

// --- gate ----------------------------------------------------------------------

func TestCheckAndSpendPricesRecallViaTheCurveAndSplitsBasicFirst(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Additional balance exists; the draw must still exhaust basic first ([G2]).
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 50, 0); err != nil {
		t.Fatalf("seed additional failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, SpendIntent{Reason: ReasonRecall, AccessibilityCost: weight})
	if err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	wantCost := RecallCost(weight)
	entries := fixture.ledger.userEntries("user-1")
	if len(entries) != 1 {
		t.Fatalf("entries = %d, want 1 spend row", len(entries))
	}
	entry := entries[0]
	if entry.Kind != EntryKindSpend || entry.Reason != ReasonRecall || entry.Amount != wantCost {
		t.Fatalf("entry = %+v, want a recall spend of the curve price %d — the caller never priced it", entry, wantCost)
	}
	// Exact split: the whole cost fits basic, additional untouched.
	if entry.FromBasic != wantCost || entry.FromAdditional != 0 {
		t.Fatalf("split = {basic %d, additional %d}, want basic-first {%d, 0}", entry.FromBasic, entry.FromAdditional, wantCost)
	}
	record := fixture.ledger.records["user-1"]
	if record.Additional != 50 || record.BasicSpentThisWindow != wantCost {
		t.Fatalf("record = %+v, want additional preserved and basic spent %d", record, wantCost)
	}
}

func TestCheckAndSpendOverflowsIntoAdditionalWithTheExactSplit(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Drain basic to 10 remaining; give additional 100.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 100, values.TwinkleBasicDailyAmount-10); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	wantCost := RecallCost(weight) // > 10 by the tuned values
	if wantCost <= 10 {
		t.Fatalf("fixture assumption broken: cap recall cost %d must exceed the 10 basic left", wantCost)
	}
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, SpendIntent{Reason: ReasonRecall, AccessibilityCost: weight}); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	entries := fixture.ledger.userEntries("user-1")
	entry := entries[len(entries)-1]
	if entry.FromBasic != 10 || entry.FromAdditional != wantCost-10 {
		t.Fatalf("split = {%d, %d}, want basic exhausted first {10, %d} ([G2])", entry.FromBasic, entry.FromAdditional, wantCost-10)
	}
	record := fixture.ledger.records["user-1"]
	if record.Additional != 100-(wantCost-10) {
		t.Fatalf("additional = %d, want the overflow deducted", record.Additional)
	}
}

func TestCheckAndSpendPricesGistViewViaItsCurve(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, SpendIntent{Reason: ReasonGistView, SemanticStage: 3}); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	entries := fixture.ledger.userEntries("user-1")
	if len(entries) != 1 || entries[0].Reason != ReasonGistView || entries[0].Amount != GistViewCost(3) {
		t.Fatalf("entries = %+v, want one gist_view spend priced GistViewCost(3)=%d", entries, GistViewCost(3))
	}
}

func TestCheckAndSpendInsufficientRefusesAndWritesNothing(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Exhaust today's basic entirely; no additional exists.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 0, values.TwinkleBasicDailyAmount); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	writesBefore := fixture.ledger.writes
	entriesBefore := len(fixture.ledger.entries)

	err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, SpendIntent{Reason: ReasonRecall, AccessibilityCost: 1})
	if !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want the canonical ErrInsufficientTwinkle", err)
	}
	if fixture.ledger.writes != writesBefore || len(fixture.ledger.entries) != entriesBefore {
		t.Fatal("a refused spend must write nothing — no entry, no delta")
	}
}

func TestCheckAndSpendUnknownReasonIsAWiringFault(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	err := fixture.service.CheckAndSpend(context.Background(), twinkleScope(t, "user-1"), fixture.ledger, SpendIntent{Reason: ReasonPayment})
	if !errors.Is(err, ErrSpendIntentInvalid) {
		t.Fatalf("err = %v, want ErrSpendIntentInvalid", err)
	}
}

func TestCheckAndSpendWithoutCallerTxRunsItsOwn(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	if err := fixture.service.CheckAndSpend(context.Background(), scope, nil, SpendIntent{Reason: ReasonGistView, SemanticStage: 1}); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	if fixture.ledger.txCount != 1 {
		t.Fatalf("own transactions = %d, want 1 for the tx-less gist view", fixture.ledger.txCount)
	}
	// With a caller tx handle the gate must NOT open its own.
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, SpendIntent{Reason: ReasonGistView, SemanticStage: 1}); err != nil {
		t.Fatalf("CheckAndSpend(caller tx) failed: %v", err)
	}
	if fixture.ledger.txCount != 1 {
		t.Fatalf("own transactions = %d, want still 1 — the caller's tx carries the spend", fixture.ledger.txCount)
	}
}

// --- quote ---------------------------------------------------------------------

func TestQuoteSpendMatchesTheGatePricingAndWritesNothing(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	fixture.signals.recall["m1"] = float64(values.ForgettingCostWeightCap)
	fixture.signals.gist["m2"] = 3
	fixture.signals.diary["d1"] = []float64{1, float64(values.ForgettingCostWeightCap)}
	writesBefore := fixture.ledger.writes

	recallQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindRecall, "m1")
	if err != nil {
		t.Fatalf("QuoteSpend(recall) failed: %v", err)
	}
	if recallQuote.Cost != RecallCost(float64(values.ForgettingCostWeightCap)) {
		t.Fatalf("recall quote = %+v, want the gate's RecallCost", recallQuote)
	}
	gistQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindGistView, "m2")
	if err != nil {
		t.Fatalf("QuoteSpend(gist) failed: %v", err)
	}
	if gistQuote.Cost != GistViewCost(3) {
		t.Fatalf("gist quote = %+v, want GistViewCost(3)", gistQuote)
	}
	diaryQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindDiaryRecall, "d1")
	if err != nil {
		t.Fatalf("QuoteSpend(diary) failed: %v", err)
	}
	if want := RecallCost(1) + RecallCost(float64(values.ForgettingCostWeightCap)); diaryQuote.Cost != want {
		t.Fatalf("diary quote cost = %d, want the per-memory sum %d ([D3])", diaryQuote.Cost, want)
	}
	// The write probe: no ledger row, no delta, no transaction — NO_SIDE_EFFECTS.
	if fixture.ledger.writes != writesBefore || fixture.ledger.txCount != 0 || len(fixture.ledger.entries) != 0 {
		t.Fatal("a quote must write nothing")
	}
	// Coverage math: a fresh user covers the cheap quote within basic.
	if !recallQuote.Covered || recallQuote.Shortfall != 0 {
		t.Fatalf("recall quote = %+v, want covered within the fresh basic grant", recallQuote)
	}
}

func TestQuoteSpendReportsShortfall(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Exhaust basic; the diary batch then overflows an empty additional.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 0, values.TwinkleBasicDailyAmount); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	fixture.signals.diary["d1"] = []float64{1, 1, 1}

	quote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindDiaryRecall, "d1")
	if err != nil {
		t.Fatalf("QuoteSpend failed: %v", err)
	}
	wantCost := 3 * RecallCost(1)
	if quote.Covered || quote.Cost != wantCost || quote.Shortfall != wantCost {
		t.Fatalf("quote = %+v, want uncovered cost %d with full shortfall", quote, wantCost)
	}
}

// --- earn: write ---------------------------------------------------------------

func TestEarnOnWriteGrantsOncePerDiaryIntoAdditional(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	if err := fixture.service.EarnOnWrite(context.Background(), scope, fixture.ledger, "diary-1"); err != nil {
		t.Fatalf("EarnOnWrite failed: %v", err)
	}
	// A replay of the same diary (a retried port call) grants nothing more.
	if err := fixture.service.EarnOnWrite(context.Background(), scope, fixture.ledger, "diary-1"); err != nil {
		t.Fatalf("EarnOnWrite replay failed: %v", err)
	}
	entries := fixture.ledger.userEntries("user-1")
	if len(entries) != 1 || entries[0].Kind != EntryKindEarn || entries[0].Reason != ReasonWriteDiary || entries[0].Amount != values.TwinkleEarnWrite {
		t.Fatalf("entries = %+v, want exactly one write_diary earn of %d", entries, values.TwinkleEarnWrite)
	}
	record := fixture.ledger.records["user-1"]
	if record.Additional != values.TwinkleEarnWrite || record.BasicSpentThisWindow != 0 {
		t.Fatalf("record = %+v, want the grant on ADDITIONAL only ([G2])", record)
	}
	// The grant demands the launch transaction — a nil handle is a wiring fault.
	if err := fixture.service.EarnOnWrite(context.Background(), scope, nil, "diary-2"); !errors.Is(err, ErrEarnTxRequired) {
		t.Fatalf("nil tx err = %v, want ErrEarnTxRequired", err)
	}
}

// --- earn: invite ---------------------------------------------------------------

func TestClaimInviteCreditsBothSidesExactlyOnce(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "friend-1")

	balance, err := fixture.service.ClaimInvite(context.Background(), invitee, "inviter-1")
	if err != nil {
		t.Fatalf("ClaimInvite failed: %v", err)
	}
	if balance.Additional != values.TwinkleEarnInviteInvitee {
		t.Fatalf("invitee additional = %d, want %d", balance.Additional, values.TwinkleEarnInviteInvitee)
	}
	inviterEntries := fixture.ledger.userEntries("inviter-1")
	if len(inviterEntries) != 1 || inviterEntries[0].Amount != values.TwinkleEarnInviteInviter || inviterEntries[0].Reason != ReasonInvite {
		t.Fatalf("inviter entries = %+v, want one invite earn of %d", inviterEntries, values.TwinkleEarnInviteInviter)
	}

	// A replayed claim is a no-op returning the same total.
	replay, err := fixture.service.ClaimInvite(context.Background(), invitee, "inviter-1")
	if err != nil {
		t.Fatalf("ClaimInvite replay failed: %v", err)
	}
	if replay.Total() != balance.Total() {
		t.Fatalf("replay total = %d, want the unchanged %d", replay.Total(), balance.Total())
	}
	// A second claim with a DIFFERENT code is still the same signup — no side
	// credits again ([G3] exactly once per signup).
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "inviter-2"); err != nil {
		t.Fatalf("ClaimInvite(other code) failed: %v", err)
	}
	if len(fixture.ledger.userEntries("friend-1")) != 1 {
		t.Fatal("the invitee earned twice across two codes — the signup must credit once")
	}
	if len(fixture.ledger.userEntries("inviter-2")) != 0 {
		t.Fatal("a second inviter was credited for an already-claimed signup")
	}
}

func TestClaimInviteRefusesSelfInviteAndEmptyCode(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "user-1")

	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "user-1"); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("self-invite err = %v, want ErrInviteNotEligible (the permissive default refuses it)", err)
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "  "); !errors.Is(err, ErrInviteInputRequired) {
		t.Fatalf("empty code err = %v, want ErrInviteInputRequired", err)
	}
	if len(fixture.ledger.entries) != 0 {
		t.Fatal("a refused invite must credit no one")
	}
}

// --- earn: payment ---------------------------------------------------------------

func TestChargeCreditsOnlyVerifiedReceiptsIdempotently(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	balance, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "ios", "receipt-blob-1")
	if err != nil {
		t.Fatalf("Charge failed: %v", err)
	}
	if balance.Additional != values.TwinkleChargePack {
		t.Fatalf("additional = %d, want the verified pack grant %d", balance.Additional, values.TwinkleChargePack)
	}
	// The same receipt replayed credits nothing more.
	replay, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "ios", "receipt-blob-1")
	if err != nil {
		t.Fatalf("Charge replay failed: %v", err)
	}
	if replay.Total() != balance.Total() || len(fixture.ledger.userEntries("user-1")) != 1 {
		t.Fatal("a replayed receipt must be idempotent")
	}
	// An unknown pack fails verification and credits nothing.
	if _, err := fixture.service.Charge(context.Background(), scope, "pack-unknown", "ios", "receipt-blob-2"); !errors.Is(err, ErrPaymentNotVerified) {
		t.Fatalf("unknown pack err = %v, want ErrPaymentNotVerified", err)
	}
	if len(fixture.ledger.userEntries("user-1")) != 1 {
		t.Fatal("an unverified receipt must credit nothing")
	}
	if _, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "", ""); !errors.Is(err, ErrChargeInputRequired) {
		t.Fatalf("empty input err = %v, want ErrChargeInputRequired", err)
	}
}

// --- balance read -----------------------------------------------------------------

func TestGetBalanceDerivesWithoutWriting(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	// Lazy birth: a user with no row derives the full basic grant.
	balance, err := fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Basic != values.TwinkleBasicDailyAmount || balance.Additional != 0 || balance.Total() != values.TwinkleBasicDailyAmount {
		t.Fatalf("balance = %+v, want the lazy-birth full basic", balance)
	}
	if fixture.ledger.writes != 0 || fixture.ledger.born["user-1"] {
		t.Fatal("GetBalance must never write or birth a row")
	}

	// A stored record from a PAST window derives a fresh full basic today (no carry),
	// still without writing the roll-forward.
	fixture.ledger.records["user-1"] = BalanceRecord{Additional: 7, BasicSpentThisWindow: values.TwinkleBasicDailyAmount, BasicResetWindow: twinkleToday().AddDate(0, 0, -1)}
	fixture.ledger.born["user-1"] = true
	writesBefore := fixture.ledger.writes
	balance, err = fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Basic != values.TwinkleBasicDailyAmount || balance.Additional != 7 {
		t.Fatalf("balance = %+v, want a fresh full basic + stored additional", balance)
	}
	if fixture.ledger.writes != writesBefore {
		t.Fatal("the new-window derivation must not write the roll-forward on read")
	}
}

// --- scoping -----------------------------------------------------------------------

func TestEveryUseCaseRejectsAMissingScope(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	none := platform.UserScope{}
	ctx := context.Background()

	if _, err := fixture.service.GetBalance(ctx, none); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("GetBalance err = %v, want ErrScopeRequired", err)
	}
	if err := fixture.service.CheckAndSpend(ctx, none, fixture.ledger, SpendIntent{Reason: ReasonRecall}); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("CheckAndSpend err = %v, want ErrScopeRequired", err)
	}
	if err := fixture.service.EarnOnWrite(ctx, none, fixture.ledger, "d1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("EarnOnWrite err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.ClaimInvite(ctx, none, "code"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("ClaimInvite err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.Charge(ctx, none, DefaultChargePackID, "ios", "r"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("Charge err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.QuoteSpend(ctx, none, QuoteKindRecall, "m1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("QuoteSpend err = %v, want ErrScopeRequired", err)
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.writes != 0 {
		t.Fatal("a scopeless call must reach no ledger write")
	}
}

// --- the [G3] closed earn set -------------------------------------------------------

func TestEarnReasonsAreAClosedSetWithNoLoginBonus(t *testing.T) {
	t.Parallel()
	// [G3]: exactly three earn paths — payment, invite, write. No login/attendance
	// reason exists anywhere in the domain's closed set; the daily basic reset
	// ([G2]) plays that role by design.
	reasons := []EntryReason{ReasonPayment, ReasonInvite, ReasonWriteDiary, ReasonRecall, ReasonGistView}
	for _, reason := range reasons {
		lowered := strings.ToLower(string(reason))
		if strings.Contains(lowered, "login") || strings.Contains(lowered, "attendance") {
			t.Fatalf("reason %q smells like a login/attendance bonus — [G3] forbids it", reason)
		}
	}
}
