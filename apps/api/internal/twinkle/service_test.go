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
	records           map[string]BalanceRecord
	born              map[string]bool
	entries           []recordedEntry
	failAppendForUser string
	txCount           int
	writes            int
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
	if scope.UserID() == f.failAppendForUser {
		return false, errors.New("injected ledger append failure")
	}
	if entry.DedupKey != nil {
		for _, existing := range f.entries {
			if existing.entry.DedupKey == nil || *existing.entry.DedupKey != *entry.DedupKey {
				continue
			}
			if existing.userID == scope.UserID() || entry.Reason == ReasonPayment {
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
	writes := f.writes
	if err := fn(f); err != nil {
		f.records, f.born, f.entries, f.writes = records, born, entries, writes
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

type strictPaymentVerifier struct {
	claims map[string]VerifiedPayment
	err    error
	calls  int
}

func (v *strictPaymentVerifier) Verify(_ context.Context, request PaymentVerificationRequest) (VerifiedPayment, error) {
	v.calls++
	if v.err != nil {
		return VerifiedPayment{}, v.err
	}
	claim, ok := v.claims[request.Receipt]
	if !ok {
		return VerifiedPayment{}, ErrPaymentNotVerified
	}
	return claim, nil
}

type strictInviteResolver struct {
	claims map[string]ResolvedSignup
	err    error
	calls  int
}

func inviteResolutionKey(code string, inviteeID string) string {
	return code + "\x00" + inviteeID
}

func (r *strictInviteResolver) Resolve(_ context.Context, request InviteResolutionRequest) (ResolvedSignup, error) {
	r.calls++
	if r.err != nil {
		return ResolvedSignup{}, r.err
	}
	claim, ok := r.claims[inviteResolutionKey(request.InviteCode, request.InviteeUserID)]
	if !ok {
		return ResolvedSignup{}, ErrInviteNotEligible
	}
	return claim, nil
}

// --- fixture -----------------------------------------------------------------

type twinkleFixture struct {
	ledger   *fakeLedger
	signals  *fakeSignals
	verifier *strictPaymentVerifier
	resolver *strictInviteResolver
	service  *Service
}

func twinkleNow() time.Time { return time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC) }

func twinkleToday() time.Time { return time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC) }

func newTwinkleFixture(t *testing.T) *twinkleFixture {
	t.Helper()
	fixture := &twinkleFixture{
		ledger:   newFakeLedger(),
		signals:  &fakeSignals{recall: map[string]float64{}, gist: map[string]int{}, diary: map[string][]float64{}},
		verifier: &strictPaymentVerifier{claims: map[string]VerifiedPayment{}},
		resolver: &strictInviteResolver{claims: map[string]ResolvedSignup{}},
	}
	ids := 0
	service, err := NewService(ServiceDeps{
		Ledger:         fixture.ledger,
		Verifier:       fixture.verifier,
		InviteResolver: fixture.resolver,
		Signals:        fixture.signals,
		Now:            twinkleNow,
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

func TestCheckAndSpendIsIdempotentPerDedupKey(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 100, 0); err != nil {
		t.Fatalf("seed additional failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	intent := SpendIntent{Reason: ReasonRecall, AccessibilityCost: weight, DedupKey: "spend:op-1:m1"}

	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, intent); err != nil {
		t.Fatalf("first spend failed: %v", err)
	}
	afterFirst := fixture.ledger.records["user-1"]

	// A duplicate append (same operation-derived dedup key) applies NO second balance delta (A3):
	// the append reports the existing row and CheckAndSpend skips ApplyBalanceDelta.
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, intent); err != nil {
		t.Fatalf("duplicate spend failed: %v", err)
	}
	afterSecond := fixture.ledger.records["user-1"]

	if afterFirst != afterSecond {
		t.Fatalf("balance moved on the duplicate spend: %+v → %+v, want unchanged", afterFirst, afterSecond)
	}
	entries := fixture.ledger.userEntries("user-1")
	if len(entries) != 1 {
		t.Fatalf("spend entries = %d, want exactly 1 for a deduped operation", len(entries))
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

	recallQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindRecall, "m1", 0)
	if err != nil {
		t.Fatalf("QuoteSpend(recall) failed: %v", err)
	}
	if recallQuote.Cost != RecallCost(float64(values.ForgettingCostWeightCap)) {
		t.Fatalf("recall quote = %+v, want the gate's RecallCost", recallQuote)
	}
	gistQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindGistView, "m2", 2)
	if err != nil {
		t.Fatalf("QuoteSpend(gist) failed: %v", err)
	}
	if gistQuote.Cost != GistViewCost(2) {
		t.Fatalf("gist quote = %+v, want selected-stage GistViewCost(2)", gistQuote)
	}
	diaryQuote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindDiaryRecall, "d1", 0)
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

func TestQuoteSpendGistRequiresASelectedRisenStage(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	fixture.signals.gist["m1"] = 2

	if _, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindGistView, "m1", 0); !errors.Is(err, ErrQuoteInputRequired) {
		t.Fatalf("stage-zero quote err = %v, want ErrQuoteInputRequired", err)
	}
	if _, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindGistView, "m1", 3); !errors.Is(err, ErrQuoteTargetUnavailable) {
		t.Fatalf("unrisen-stage quote err = %v, want ErrQuoteTargetUnavailable", err)
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

	quote, err := fixture.service.QuoteSpend(context.Background(), scope, QuoteKindDiaryRecall, "d1", 0)
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
	trusted := ResolvedSignup{SignupID: "signup-1", InviterUserID: "inviter-1", InviteeUserID: "friend-1"}
	fixture.resolver.claims[inviteResolutionKey("opaque-code-1", "friend-1")] = trusted
	fixture.resolver.claims[inviteResolutionKey("opaque-code-2", "friend-1")] = trusted

	balance, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque-code-1")
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
	replay, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque-code-1")
	if err != nil {
		t.Fatalf("ClaimInvite replay failed: %v", err)
	}
	if replay.Total() != balance.Total() {
		t.Fatalf("replay total = %d, want the unchanged %d", replay.Total(), balance.Total())
	}
	// A second claim with a DIFFERENT code is still the same signup — no side
	// credits again ([G3] exactly once per signup).
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque-code-2"); err != nil {
		t.Fatalf("ClaimInvite(other code) failed: %v", err)
	}
	if len(fixture.ledger.userEntries("friend-1")) != 1 {
		t.Fatal("the invitee earned twice across two codes — the signup must credit once")
	}
}

func TestClaimInviteRefusesUntrustedAndMismatchedClaims(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "user-1")
	fixture.resolver.claims[inviteResolutionKey("self-code", "user-1")] = ResolvedSignup{
		SignupID: "signup-self", InviterUserID: "user-1", InviteeUserID: "user-1",
	}
	fixture.resolver.claims[inviteResolutionKey("wrong-beneficiary", "user-1")] = ResolvedSignup{
		SignupID: "signup-other", InviterUserID: "inviter-1", InviteeUserID: "user-2",
	}
	fixture.resolver.claims[inviteResolutionKey("padded-beneficiary", "user-1")] = ResolvedSignup{
		SignupID: "signup-padded-beneficiary", InviterUserID: "inviter-1", InviteeUserID: " user-1 ",
	}
	fixture.resolver.claims[inviteResolutionKey("padded-inviter", "user-1")] = ResolvedSignup{
		SignupID: "signup-padded-inviter", InviterUserID: " inviter-1 ", InviteeUserID: "user-1",
	}
	fixture.resolver.claims[inviteResolutionKey("padded-signup", "user-1")] = ResolvedSignup{
		SignupID: " signup-padded ", InviterUserID: "inviter-1", InviteeUserID: "user-1",
	}

	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "self-code"); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("self-invite err = %v, want ErrInviteNotEligible", err)
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "wrong-beneficiary"); !errors.Is(err, ErrInviteBeneficiaryMismatch) {
		t.Fatalf("beneficiary mismatch err = %v, want ErrInviteBeneficiaryMismatch", err)
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "padded-beneficiary"); !errors.Is(err, ErrInviteBeneficiaryMismatch) {
		t.Fatalf("padded beneficiary err = %v, want ErrInviteBeneficiaryMismatch", err)
	}
	for _, code := range []string{"padded-inviter", "padded-signup"} {
		if _, err := fixture.service.ClaimInvite(context.Background(), invitee, code); !errors.Is(err, ErrInviteNotEligible) {
			t.Fatalf("%s err = %v, want ErrInviteNotEligible", code, err)
		}
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "user-2"); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("raw/nonexistent inviter err = %v, want ErrInviteNotEligible", err)
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "  "); !errors.Is(err, ErrInviteInputRequired) {
		t.Fatalf("empty code err = %v, want ErrInviteInputRequired", err)
	}
	if len(fixture.ledger.entries) != 0 {
		t.Fatal("a refused invite must credit no one")
	}
}

func TestClaimInviteAdapterAndTransactionFailuresCreditNeitherSide(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "friend-1")

	fixture.resolver.err = errors.New("directory detail that must stay private")
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque"); !errors.Is(err, ErrInviteNotEligible) || strings.Contains(err.Error(), "directory detail") {
		t.Fatalf("resolver failure err = %v, want sanitized ErrInviteNotEligible", err)
	}
	fixture.resolver.err = nil
	fixture.resolver.claims[inviteResolutionKey("opaque", "friend-1")] = ResolvedSignup{
		SignupID: "signup-1", InviterUserID: "inviter-1", InviteeUserID: "friend-1",
	}
	fixture.ledger.failAppendForUser = "inviter-1"
	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque"); err == nil {
		t.Fatal("injected inviter persistence failure succeeded")
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.born["friend-1"] || fixture.ledger.born["inviter-1"] {
		t.Fatal("a failed atomic invite grant left a one-sided balance or ledger entry")
	}
}

func TestClaimInviteRollsBackWhenOnlyTheInviterDedupKeyAlreadyExists(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "friend-1")
	inviter := twinkleScope(t, "inviter-1")
	fixture.resolver.claims[inviteResolutionKey("opaque", "friend-1")] = ResolvedSignup{
		SignupID: "signup-1", InviterUserID: "inviter-1", InviteeUserID: "friend-1",
	}
	staleKey := "invite:signup-1"
	fixture.ledger.entries = append(fixture.ledger.entries, recordedEntry{
		userID: inviter.UserID(),
		entry:  LedgerEntry{ID: "historical", Kind: EntryKindEarn, Reason: ReasonInvite, Amount: 1, DedupKey: &staleKey},
	})

	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque"); !errors.Is(err, ErrInviteGrantConflict) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteGrantConflict", err)
	}
	if len(fixture.ledger.userEntries("friend-1")) != 0 || fixture.ledger.born["friend-1"] {
		t.Fatal("an inconsistent inviter dedup conflict left a one-sided invitee grant")
	}
}

func TestClaimInviteRejectsWhenOnlyTheInviteeDedupKeyAlreadyExists(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "friend-1")
	fixture.resolver.claims[inviteResolutionKey("opaque", "friend-1")] = ResolvedSignup{
		SignupID: "signup-1", InviterUserID: "inviter-1", InviteeUserID: "friend-1",
	}
	staleKey := "invite_signup:signup-1"
	fixture.ledger.entries = append(fixture.ledger.entries, recordedEntry{
		userID: invitee.UserID(),
		entry:  LedgerEntry{ID: "historical", Kind: EntryKindEarn, Reason: ReasonInvite, Amount: 1, DedupKey: &staleKey},
	})

	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "opaque"); !errors.Is(err, ErrInviteGrantConflict) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteGrantConflict", err)
	}
	if len(fixture.ledger.userEntries("inviter-1")) != 0 || fixture.ledger.born["inviter-1"] {
		t.Fatal("an inconsistent invitee dedup conflict was silently repaired with a one-sided inviter grant")
	}
}

// --- earn: payment ---------------------------------------------------------------

func TestChargeCreditsOnlyVerifiedReceiptsIdempotently(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	fixture.verifier.claims["receipt-blob-1"] = VerifiedPayment{
		ProviderTransactionID: "transaction-1",
		Provider:              "app-store",
		PackID:                DefaultChargePackID,
		Amount:                values.TwinkleChargePack,
		BeneficiaryUserID:     "user-1",
	}

	balance, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "app-store", "receipt-blob-1")
	if err != nil {
		t.Fatalf("Charge failed: %v", err)
	}
	if balance.Additional != values.TwinkleChargePack {
		t.Fatalf("additional = %d, want the verified pack grant %d", balance.Additional, values.TwinkleChargePack)
	}
	// The same receipt replayed credits nothing more.
	replay, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "app-store", "receipt-blob-1")
	if err != nil {
		t.Fatalf("Charge replay failed: %v", err)
	}
	if replay.Total() != balance.Total() || len(fixture.ledger.userEntries("user-1")) != 1 {
		t.Fatal("a replayed receipt must be idempotent")
	}
	// An unknown pack fails verification and credits nothing.
	if _, err := fixture.service.Charge(context.Background(), scope, "pack-unknown", "app-store", "receipt-blob-2"); !errors.Is(err, ErrPaymentNotVerified) {
		t.Fatalf("unknown pack err = %v, want ErrPaymentNotVerified", err)
	}
	if len(fixture.ledger.userEntries("user-1")) != 1 {
		t.Fatal("an unverified receipt must credit nothing")
	}
	if _, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "", ""); !errors.Is(err, ErrChargeInputRequired) {
		t.Fatalf("empty input err = %v, want ErrChargeInputRequired", err)
	}
}

func TestChargeRejectsUnboundOrMalformedVerifiedClaims(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	base := VerifiedPayment{
		ProviderTransactionID: "transaction-1",
		Provider:              "app-store",
		PackID:                DefaultChargePackID,
		Amount:                values.TwinkleChargePack,
		BeneficiaryUserID:     "user-1",
	}
	cases := []struct {
		name  string
		claim VerifiedPayment
		want  error
	}{
		{name: "beneficiary", claim: func() VerifiedPayment { c := base; c.BeneficiaryUserID = "user-2"; return c }(), want: ErrPaymentBeneficiaryMismatch},
		{name: "padded beneficiary", claim: func() VerifiedPayment { c := base; c.BeneficiaryUserID = " user-1 "; return c }(), want: ErrPaymentBeneficiaryMismatch},
		{name: "transaction", claim: func() VerifiedPayment { c := base; c.ProviderTransactionID = ""; return c }(), want: ErrPaymentNotVerified},
		{name: "unnormalized transaction", claim: func() VerifiedPayment { c := base; c.ProviderTransactionID = " transaction-1 "; return c }(), want: ErrPaymentNotVerified},
		{name: "provider", claim: func() VerifiedPayment { c := base; c.Provider = "play-store"; return c }(), want: ErrPaymentNotVerified},
		{name: "pack", claim: func() VerifiedPayment { c := base; c.PackID = "unknown"; return c }(), want: ErrPaymentNotVerified},
		{name: "amount", claim: func() VerifiedPayment { c := base; c.Amount = 0; return c }(), want: ErrPaymentNotVerified},
	}
	for _, test := range cases {
		test := test
		t.Run(test.name, func(t *testing.T) {
			receipt := "receipt-" + test.name
			fixture.verifier.claims[receipt] = test.claim
			if _, err := fixture.service.Charge(context.Background(), scope, DefaultChargePackID, "app-store", receipt); !errors.Is(err, test.want) {
				t.Fatalf("Charge err = %v, want %v", err, test.want)
			}
		})
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.born["user-1"] {
		t.Fatal("invalid verified claims must not credit or birth a balance")
	}
}

func TestChargeSanitizesVerifierFailuresAndGloballyDeduplicatesTransactions(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	first := twinkleScope(t, "user-1")
	second := twinkleScope(t, "user-2")

	fixture.verifier.err = errors.New("provider secret receipt detail")
	if _, err := fixture.service.Charge(context.Background(), first, DefaultChargePackID, "app-store", "secret-receipt"); !errors.Is(err, ErrPaymentNotVerified) || strings.Contains(err.Error(), "secret") {
		t.Fatalf("verifier failure err = %v, want sanitized ErrPaymentNotVerified", err)
	}
	fixture.verifier.err = nil
	claim := VerifiedPayment{
		ProviderTransactionID: "transaction-global",
		Provider:              "app-store",
		PackID:                DefaultChargePackID,
		Amount:                values.TwinkleChargePack,
		BeneficiaryUserID:     "user-1",
	}
	fixture.verifier.claims["receipt-1"] = claim
	if _, err := fixture.service.Charge(context.Background(), first, DefaultChargePackID, "app-store", "receipt-1"); err != nil {
		t.Fatalf("first Charge failed: %v", err)
	}
	claim.BeneficiaryUserID = "user-2"
	fixture.verifier.claims["receipt-2"] = claim
	secondBalance, err := fixture.service.Charge(context.Background(), second, DefaultChargePackID, "app-store", "receipt-2")
	if err != nil {
		t.Fatalf("cross-user replay failed: %v", err)
	}
	if secondBalance.Additional != 0 || len(fixture.ledger.entries) != 1 {
		t.Fatalf("cross-user replay balance=%+v entries=%d, want no second grant", secondBalance, len(fixture.ledger.entries))
	}
}

func TestFailClosedEarnAdaptersReturnCanonicalUnavailableErrors(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	service, err := NewService(ServiceDeps{
		Ledger:         fixture.ledger,
		Verifier:       UnavailablePaymentVerifier{},
		InviteResolver: UnavailableInviteResolver{},
		Signals:        fixture.signals,
		Now:            twinkleNow,
		NewID:          func() string { return "entry" },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope := twinkleScope(t, "user-1")
	if _, err := service.Charge(context.Background(), scope, DefaultChargePackID, "app-store", "arbitrary-receipt"); !errors.Is(err, ErrPaymentVerificationUnavailable) {
		t.Fatalf("Charge err = %v, want ErrPaymentVerificationUnavailable", err)
	}
	if _, err := service.ClaimInvite(context.Background(), scope, "arbitrary-code"); !errors.Is(err, ErrInviteResolutionUnavailable) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteResolutionUnavailable", err)
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.writes != 0 {
		t.Fatal("unavailable trust adapters must reach no ledger write")
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
	if _, err := fixture.service.QuoteSpend(ctx, none, QuoteKindRecall, "m1", 0); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("QuoteSpend err = %v, want ErrScopeRequired", err)
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.writes != 0 {
		t.Fatal("a scopeless call must reach no ledger write")
	}
}

// --- the [G3] closed earn set -------------------------------------------------------

func TestEarnReasonsAreAClosedSetWithNoLoginBonus(t *testing.T) {
	t.Parallel()
	// [G3]: the earn paths are payment, invite, write, plus the discretionary admin_grant
	// (별가루 증정, the admin console). No login/attendance reason exists anywhere in the domain's closed
	// set; the daily basic reset ([G2]) plays that role by design — admin_grant is an operator
	// gift, not a recurring/automatic bonus.
	reasons := []EntryReason{ReasonPayment, ReasonInvite, ReasonWriteDiary, ReasonRecall, ReasonGistView, ReasonAdminGrant}
	for _, reason := range reasons {
		lowered := strings.ToLower(string(reason))
		if strings.Contains(lowered, "login") || strings.Contains(lowered, "attendance") {
			t.Fatalf("reason %q smells like a login/attendance bonus — [G3] forbids it", reason)
		}
	}
}
