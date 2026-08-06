package twinkle

import (
	"context"
	"errors"
	"fmt"
	"sort"
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

func (f *fakeLedger) ApplyBalanceDelta(_ context.Context, scope platform.UserScope, resetWindow time.Time, generalDelta int, smallSpentDelta int) (BalanceRecord, error) {
	if scope.UserID() == "" {
		return BalanceRecord{}, errors.New("scope missing")
	}
	f.writes++
	window := time.Date(resetWindow.UTC().Year(), resetWindow.UTC().Month(), resetWindow.UTC().Day(), 0, 0, 0, 0, time.UTC)
	record := f.records[scope.UserID()]
	spent := record.SmallSpentThisWindow + smallSpentDelta
	if record.SmallResetWindow.Before(window) {
		spent = smallSpentDelta
	}
	if spent > values.TwinkleSmallDailyAmount {
		return BalanceRecord{}, fmt.Errorf("%w: %w", errFakeOversell, ErrInsufficientTwinkle)
	}
	general := record.General + generalDelta
	if general < 0 {
		return BalanceRecord{}, errFakeOversell
	}
	next := BalanceRecord{General: general, SmallSpentThisWindow: spent, SmallResetWindow: window}
	if record.SmallResetWindow.After(window) {
		next.SmallResetWindow = record.SmallResetWindow
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

func (f *fakeLedger) LockInviteRewardsByInviter(context.Context, platform.UserScope) error {
	return nil
}

func (f *fakeLedger) GetInviteRewardState(
	_ context.Context,
	scope platform.UserScope,
	dedupKey string,
) (int64, bool, error) {
	var count int64
	replay := false
	for _, existing := range f.entries {
		if existing.userID != scope.UserID() || existing.entry.Kind != EntryKindEarn ||
			existing.entry.Reason != ReasonInvite || existing.entry.DedupKey == nil ||
			!strings.HasPrefix(*existing.entry.DedupKey, "invite:") {
			continue
		}
		count++
		replay = replay || *existing.entry.DedupKey == dedupKey
	}
	return count, replay, nil
}

// ListLedgerPage mirrors the store's keyset semantics in memory: newest first on (created_at, id),
// strictly after the cursor, capped by limit — so the paging tests assert the real contract.
func (f *fakeLedger) ListLedgerPage(_ context.Context, scope platform.UserScope, cursor *LedgerCursor, limit int) ([]LedgerEntry, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	rows := f.userEntries(scope.UserID())
	sort.Slice(rows, func(i, j int) bool {
		if !rows[i].CreatedAt.Equal(rows[j].CreatedAt) {
			return rows[i].CreatedAt.After(rows[j].CreatedAt)
		}
		return rows[i].ID > rows[j].ID
	})
	page := []LedgerEntry{}
	for _, row := range rows {
		if cursor != nil {
			after := row.CreatedAt.After(cursor.CreatedAt) ||
				(row.CreatedAt.Equal(cursor.CreatedAt) && row.ID >= cursor.ID)
			if after {
				continue
			}
		}
		if len(page) == limit {
			break
		}
		page = append(page, row)
	}
	return page, nil
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

// fakeUserZone stands in for the composition root's account adapter: an IANA name per user, so a
// test can move a user's day boundary the way the /me control does.
type fakeUserZone struct {
	names    map[string]string
	fallback string
	err      error
}

func (f *fakeUserZone) ZoneFor(_ context.Context, scope platform.UserScope) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	if name, ok := f.names[scope.UserID()]; ok {
		return name, nil
	}
	return f.fallback, nil
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
	resolver *strictInviteResolver
	zones    *fakeUserZone
	service  *Service
}

func twinkleNow() time.Time { return time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC) }

func twinkleToday() time.Time { return time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC) }

func newTwinkleFixture(t *testing.T) *twinkleFixture {
	t.Helper()
	fixture := &twinkleFixture{
		ledger:   newFakeLedger(),
		signals:  &fakeSignals{recall: map[string]float64{}, gist: map[string]int{}, diary: map[string][]float64{}},
		resolver: &strictInviteResolver{claims: map[string]ResolvedSignup{}},
		zones:    &fakeUserZone{names: map[string]string{}, fallback: "UTC"},
	}
	ids := 0
	service, err := NewService(ServiceDeps{
		Ledger:         fixture.ledger,
		InviteResolver: fixture.resolver,
		Signals:        fixture.signals,
		UserZone:       fixture.zones,
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

// --- the day boundary ([G2][U7]) -----------------------------------------------

func TestNewServiceRequiresEveryTrustBoundary(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)

	// A5: the zone reader is required exactly like the ledger and the signal reader. Production
	// cannot boot with the SMALL reset boundary unbound, and the package exports no permissive UTC
	// adapter that a composition root could bind here instead.
	if _, err := NewService(ServiceDeps{
		Ledger:         fixture.ledger,
		InviteResolver: fixture.resolver,
		Signals:        fixture.signals,
	}); !errors.Is(err, ErrZoneReaderRequired) {
		t.Fatalf("NewService(no zone reader) err = %v, want ErrZoneReaderRequired", err)
	}
}

func TestGetBalanceReadsTheUsersOwnCalendarDay(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// The anchor is 07-14 with the day fully spent. At 2026-07-14T23:00Z that is still 07-14 in
	// UTC — but already 07-15 in Seoul, so a Seoul diarist's day has turned and SMALL refills.
	fixture.ledger.records["user-1"] = BalanceRecord{
		General:              5,
		SmallSpentThisWindow: values.TwinkleSmallDailyAmount,
		SmallResetWindow:     twinkleToday(),
	}
	fixture.ledger.born["user-1"] = true
	lateEvening := time.Date(2026, 7, 14, 23, 0, 0, 0, time.UTC)
	fixture.service.now = func() time.Time { return lateEvening }

	balance, err := fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Small != 0 {
		t.Fatalf("small = %d, want 0 — the UTC user's day has not turned", balance.Small)
	}

	fixture.zones.names["user-1"] = "Asia/Seoul"
	balance, err = fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance(Seoul) failed: %v", err)
	}
	if balance.Small != values.TwinkleSmallDailyAmount {
		t.Fatalf("small = %d, want a fresh grant %d — the Seoul user's day HAS turned", balance.Small, values.TwinkleSmallDailyAmount)
	}

	// [G5]: an unknown or blank zone reads as UTC and never suppresses the refill or errors.
	for _, name := range []string{"", "   ", "Not/AZone"} {
		fixture.zones.names["user-1"] = name
		if _, err := fixture.service.GetBalance(context.Background(), scope); err != nil {
			t.Fatalf("GetBalance(zone %q) err = %v, want the UTC fallback and no error", name, err)
		}
	}
}

func TestSpendAnchorsTheWindowAndNeverMovesItBackward(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// A6: eastward first. At 2026-07-14T12:00Z a Kiritimati (UTC+14) user is already on 07-15, so
	// the spend anchors the window there.
	fixture.zones.names["user-1"] = "Pacific/Kiritimati"
	weight := float64(values.ForgettingCostWeightCap)
	cost := RecallCost(weight)
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger,
		RecallSpendIntent(weight, "spend:east")); err != nil {
		t.Fatalf("eastward spend failed: %v", err)
	}
	anchored := fixture.ledger.records["user-1"]
	if got := anchored.SmallResetWindow.Format(time.DateOnly); got != "2026-07-15" {
		t.Fatalf("anchor = %s, want the user's local 2026-07-15", got)
	}

	// Then westward, at the SAME instant: Niue (UTC−11) reads 07-14. The stored anchor must not
	// move back, and the derived SMALL must be the conservative grant − spent, never a second full
	// grant for a date already anchored past.
	fixture.zones.names["user-1"] = "Pacific/Niue"
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger,
		RecallSpendIntent(weight, "spend:west")); err != nil {
		t.Fatalf("westward spend failed: %v", err)
	}
	after := fixture.ledger.records["user-1"]
	if got := after.SmallResetWindow.Format(time.DateOnly); got != "2026-07-15" {
		t.Fatalf("anchor moved to %s, want it pinned at 2026-07-15 (GREATEST)", got)
	}
	if after.SmallSpentThisWindow != 2*cost {
		t.Fatalf("spent = %d, want both draws accumulated in one window %d", after.SmallSpentThisWindow, 2*cost)
	}
	balance, err := fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Small != values.TwinkleSmallDailyAmount-2*cost {
		t.Fatalf("small = %d, want the conservative grant − spent %d — a zone toggle must not mint a grant",
			balance.Small, values.TwinkleSmallDailyAmount-2*cost)
	}
}

// --- the [G5] affordability contract ------------------------------------------

func TestCoreLoopProtectionRelationship(t *testing.T) {
	t.Parallel()
	// [G5] as a relationship over the GENERATED constants, not a magic number: the
	// daily SMALL grant must cover a typical day's ruminative recalls at the cheap
	// end of the recall curve, so the gate only ever bites excess. The
	// expected-daily-ruminations figure is this test's documented product
	// assumption (a handful of everyday recalls, [M5]).
	const expectedDailyRuminations = 5
	cheapRecallCost := RecallCost(float64(values.ForgettingCostWeightFloor))
	if cheapRecallCost <= 0 {
		t.Fatalf("cheap recall cost = %d, want > 0 (never free, [G1])", cheapRecallCost)
	}
	if values.TwinkleSmallDailyAmount < expectedDailyRuminations*cheapRecallCost {
		t.Fatalf("small_daily_amount %d < %d expected ruminations × cheap recall %d — the gate would bite everyday rumination ([G5])",
			values.TwinkleSmallDailyAmount, expectedDailyRuminations, cheapRecallCost)
	}
}

// --- gate ----------------------------------------------------------------------

func TestCheckAndSpendPricesRecallViaTheCurveAndSplitsSmallFirst(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// GENERAL balance exists; the draw must still exhaust SMALL first ([G2]).
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 50, 0); err != nil {
		t.Fatalf("seed general failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, RecallSpendIntent(weight, ""))
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
	// Exact split: the whole cost fits SMALL, GENERAL untouched.
	if entry.FromSmall != wantCost || entry.FromGeneral != 0 {
		t.Fatalf("split = {small %d, general %d}, want SMALL-first {%d, 0}", entry.FromSmall, entry.FromGeneral, wantCost)
	}
	record := fixture.ledger.records["user-1"]
	if record.General != 50 || record.SmallSpentThisWindow != wantCost {
		t.Fatalf("record = %+v, want general preserved and small spent %d", record, wantCost)
	}
}

func TestCheckAndSpendIsIdempotentPerDedupKey(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 100, 0); err != nil {
		t.Fatalf("seed general failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	intent := RecallSpendIntent(weight, "spend:op-1:m1")

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

func TestCheckAndSpendOverflowsIntoGeneralWithTheExactSplit(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Drain SMALL to 10 remaining; give GENERAL 100.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 100, values.TwinkleSmallDailyAmount-10); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	weight := float64(values.ForgettingCostWeightCap)
	wantCost := RecallCost(weight) // > 10 by the tuned values
	if wantCost <= 10 {
		t.Fatalf("fixture assumption broken: cap recall cost %d must exceed the 10 small left", wantCost)
	}
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, RecallSpendIntent(weight, "")); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	entries := fixture.ledger.userEntries("user-1")
	entry := entries[len(entries)-1]
	if entry.FromSmall != 10 || entry.FromGeneral != wantCost-10 {
		t.Fatalf("split = {%d, %d}, want SMALL exhausted first {10, %d} ([G2])", entry.FromSmall, entry.FromGeneral, wantCost-10)
	}
	record := fixture.ledger.records["user-1"]
	if record.General != 100-(wantCost-10) {
		t.Fatalf("general = %d, want the overflow deducted", record.General)
	}
}

func TestCheckAndSpendPricesGistViewViaItsCurve(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, GistViewSpendIntent(3, "")); err != nil {
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
	// Exhaust today's SMALL entirely; no GENERAL exists.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 0, values.TwinkleSmallDailyAmount); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	writesBefore := fixture.ledger.writes
	entriesBefore := len(fixture.ledger.entries)

	err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, RecallSpendIntent(1, ""))
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
	// A zero-value intent is what a caller gets by bypassing the constructors — it carries no reason,
	// so it is refused as the composition fault it is rather than priced as something.
	err := fixture.service.CheckAndSpend(context.Background(), twinkleScope(t, "user-1"), fixture.ledger, SpendIntent{})
	if !errors.Is(err, ErrSpendIntentInvalid) {
		t.Fatalf("err = %v, want ErrSpendIntentInvalid", err)
	}
}

func TestCheckAndSpendWithoutCallerTxRunsItsOwn(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	if err := fixture.service.CheckAndSpend(context.Background(), scope, nil, GistViewSpendIntent(1, "")); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	if fixture.ledger.txCount != 1 {
		t.Fatalf("own transactions = %d, want 1 for the tx-less gist view", fixture.ledger.txCount)
	}
	// With a caller tx handle the gate must NOT open its own.
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, GistViewSpendIntent(1, "")); err != nil {
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

	recallQuote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindRecall, "m1")
	if err != nil {
		t.Fatalf("QuoteSpend(recall) failed: %v", err)
	}
	if recallQuote.Cost != RecallCost(float64(values.ForgettingCostWeightCap)) {
		t.Fatalf("recall quote = %+v, want the gate's RecallCost", recallQuote)
	}
	gistQuote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindGistView, "m2")
	if err != nil {
		t.Fatalf("QuoteSpend(gist) failed: %v", err)
	}
	// Priced at the memory's OWN reached stage (3), not at anything a caller could name.
	if gistQuote.Cost != GistViewCost(3) {
		t.Fatalf("gist quote = %+v, want the derived-stage GistViewCost(3)", gistQuote)
	}
	diaryQuote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindDiaryRecall, "d1")
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
	// Coverage math: a fresh user covers the cheap quote within SMALL.
	if !recallQuote.Covered || recallQuote.Shortfall != 0 {
		t.Fatalf("recall quote = %+v, want covered within the fresh SMALL grant", recallQuote)
	}
}

func TestQuoteSpendGistPricesTheMemorysOwnStage(t *testing.T) {
	t.Parallel()
	scope := twinkleScope(t, "user-1")

	// A6: the price falls as the memory's own stage deepens, and no caller can choose which rung
	// it is quoted at — the quote and the read derive the same number from the same memory.
	previous := 0
	for stage := 4; stage >= 1; stage-- {
		fixture := newTwinkleFixture(t)
		fixture.signals.gist["m1"] = stage
		quote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindGistView, "m1")
		if err != nil {
			t.Fatalf("stage %d quote failed: %v", stage, err)
		}
		if quote.Cost != GistViewCost(stage) {
			t.Fatalf("stage %d quote = %d, want GistViewCost(%d)", stage, quote.Cost, stage)
		}
		if previous != 0 && quote.Cost <= previous {
			t.Fatalf("stage %d cost %d did not rise as the ladder got shallower", stage, quote.Cost)
		}
		previous = quote.Cost
	}
}

func TestQuoteSpendReportsShortfall(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// Exhaust SMALL; the diary batch then overflows an empty GENERAL.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 0, values.TwinkleSmallDailyAmount); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	fixture.signals.diary["d1"] = []float64{1, 1, 1}

	quote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindDiaryRecall, "d1")
	if err != nil {
		t.Fatalf("QuoteSpend failed: %v", err)
	}
	wantCost := 3 * RecallCost(1)
	if quote.Covered || quote.Cost != wantCost || quote.Shortfall != wantCost {
		t.Fatalf("quote = %+v, want uncovered cost %d with full shortfall", quote, wantCost)
	}
}

func TestQuoteSpendShortfallIsKindAwareAndUnquotableKindsAreRefused(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// SMALL half-drained, a little GENERAL: the quote's shortfall must be exactly what the kinds
	// that may pay cannot absorb (A9), not `cost − every tier`.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 10, values.TwinkleSmallDailyAmount-30); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	fixture.signals.diary["d1"] = []float64{1, 1, 1, 1, 1}

	quote, err := fixture.service.QuoteSpend(context.Background(), scope, SpendKindDiaryRecall, "d1")
	if err != nil {
		t.Fatalf("QuoteSpend failed: %v", err)
	}
	if want := ShortfallFor(30, 10, quote.Cost, SpendKindDiaryRecall); quote.Shortfall != want {
		t.Fatalf("shortfall = %d, want the kind-aware %d", quote.Shortfall, want)
	}

	// A10: a purpose SMALL may not pay for is not quotable at all — the recall pricer has no
	// purchase arm, so no quote can ever report a purchase as covered by the recall allowance.
	for _, kind := range []SpendKind{SpendKindPurchase, SpendKind("a_future_kind")} {
		if _, err := fixture.service.QuoteSpend(context.Background(), scope, kind, "d1"); !errors.Is(err, ErrQuoteInputRequired) {
			t.Fatalf("QuoteSpend(%q) err = %v, want ErrQuoteInputRequired", kind, err)
		}
	}
}

// --- earn: write ---------------------------------------------------------------

func TestEarnOnWriteGrantsOncePerDiaryIntoGeneral(t *testing.T) {
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
	if record.General != values.TwinkleEarnWrite || record.SmallSpentThisWindow != 0 {
		t.Fatalf("record = %+v, want the grant on GENERAL only ([G2])", record)
	}
	// The grant demands the launch transaction — a nil handle is a wiring fault.
	if err := fixture.service.EarnOnWrite(context.Background(), scope, nil, "diary-2"); !errors.Is(err, ErrEarnTxRequired) {
		t.Fatalf("nil tx err = %v, want ErrEarnTxRequired", err)
	}
}

func TestEarnSignupBonusGrantsGeneralOncePerAccount(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "new-account")

	for range 2 {
		balance, err := fixture.service.EarnSignupBonus(context.Background(), scope)
		if err != nil {
			t.Fatalf("EarnSignupBonus failed: %v", err)
		}
		if balance.General != values.TwinkleEarnSignupBonus {
			t.Fatalf("general = %d, want one signup bonus %d", balance.General, values.TwinkleEarnSignupBonus)
		}
	}
	entries := fixture.ledger.userEntries("new-account")
	if len(entries) != 1 || entries[0].Kind != EntryKindEarn ||
		entries[0].Reason != ReasonSignupBonus || entries[0].Amount != values.TwinkleEarnSignupBonus ||
		entries[0].DedupKey == nil || *entries[0].DedupKey != "signup_bonus:new-account" {
		t.Fatalf("entries = %+v, want one GENERAL signup_bonus row", entries)
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
	if balance.General != values.TwinkleEarnInviteInvitee {
		t.Fatalf("invitee general = %d, want %d", balance.General, values.TwinkleEarnInviteInvitee)
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

func TestClaimInviteEnforcesLifetimeCapAndAdmitsExactReplay(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	inviterID := "capped-inviter"
	for index := range values.TwinkleInviteRewardMaxPerInviter {
		inviteeID := fmt.Sprintf("friend-%d", index)
		code := fmt.Sprintf("code-%d", index)
		fixture.resolver.claims[inviteResolutionKey(code, inviteeID)] = ResolvedSignup{
			SignupID:      fmt.Sprintf("signup-%d", index),
			InviterUserID: inviterID,
			InviteeUserID: inviteeID,
		}
		if _, err := fixture.service.ClaimInvite(context.Background(), twinkleScope(t, inviteeID), code); err != nil {
			t.Fatalf("ClaimInvite(%d) failed: %v", index, err)
		}
	}
	blockedID := "blocked-friend"
	fixture.resolver.claims[inviteResolutionKey("blocked-code", blockedID)] = ResolvedSignup{
		SignupID:      "blocked-signup",
		InviterUserID: inviterID,
		InviteeUserID: blockedID,
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), twinkleScope(t, blockedID), "blocked-code"); !errors.Is(err, ErrInviteNotEligible) {
		t.Fatalf("over-cap ClaimInvite err = %v, want ErrInviteNotEligible", err)
	}
	if got := len(fixture.ledger.userEntries(inviterID)); got != values.TwinkleInviteRewardMaxPerInviter {
		t.Fatalf("inviter reward rows = %d, want cap %d", got, values.TwinkleInviteRewardMaxPerInviter)
	}
	if _, err := fixture.service.ClaimInvite(context.Background(), twinkleScope(t, "friend-0"), "code-0"); err != nil {
		t.Fatalf("at-cap exact replay failed: %v", err)
	}
	if got := len(fixture.ledger.userEntries(inviterID)); got != values.TwinkleInviteRewardMaxPerInviter {
		t.Fatalf("replay changed inviter reward rows to %d", got)
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

// --- the fail-closed trust seam ---------------------------------------------------

func TestFailClosedEarnAdaptersReturnCanonicalUnavailableErrors(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	service, err := NewService(ServiceDeps{
		Ledger:         fixture.ledger,
		InviteResolver: UnavailableInviteResolver{},
		Signals:        fixture.signals,
		UserZone:       fixture.zones,
		Now:            twinkleNow,
		NewID:          func() string { return "entry" },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	scope := twinkleScope(t, "user-1")
	if _, err := service.ClaimInvite(context.Background(), scope, "arbitrary-code"); !errors.Is(err, ErrInviteResolutionUnavailable) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteResolutionUnavailable", err)
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.writes != 0 {
		t.Fatal("an unavailable trust adapter must reach no ledger write")
	}
}

// --- balance read -----------------------------------------------------------------

func TestGetBalanceDerivesWithoutWriting(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	// Lazy birth: a user with no row derives the full SMALL grant.
	balance, err := fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Small != values.TwinkleSmallDailyAmount || balance.General != 0 || balance.Total() != values.TwinkleSmallDailyAmount {
		t.Fatalf("balance = %+v, want the lazy-birth full SMALL", balance)
	}
	if fixture.ledger.writes != 0 || fixture.ledger.born["user-1"] {
		t.Fatal("GetBalance must never write or birth a row")
	}

	// A stored record from a PAST window derives a fresh full SMALL today (no carry),
	// still without writing the roll-forward.
	fixture.ledger.records["user-1"] = BalanceRecord{General: 7, SmallSpentThisWindow: values.TwinkleSmallDailyAmount, SmallResetWindow: twinkleToday().AddDate(0, 0, -1)}
	fixture.ledger.born["user-1"] = true
	writesBefore := fixture.ledger.writes
	balance, err = fixture.service.GetBalance(context.Background(), scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Small != values.TwinkleSmallDailyAmount || balance.General != 7 {
		t.Fatalf("balance = %+v, want a fresh full SMALL + stored GENERAL", balance)
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
	if err := fixture.service.CheckAndSpend(ctx, none, fixture.ledger, RecallSpendIntent(0, "")); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("CheckAndSpend err = %v, want ErrScopeRequired", err)
	}
	if err := fixture.service.EarnOnWrite(ctx, none, fixture.ledger, "d1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("EarnOnWrite err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.ClaimInvite(ctx, none, "code"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("ClaimInvite err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.EarnAchievementReward(ctx, none, "claim-1", 10); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("EarnAchievementReward err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.GetLedger(ctx, none, 0, ""); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("GetLedger err = %v, want ErrScopeRequired", err)
	}
	if _, err := fixture.service.QuoteSpend(ctx, none, SpendKindRecall, "m1"); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("QuoteSpend err = %v, want ErrScopeRequired", err)
	}
	if len(fixture.ledger.entries) != 0 || fixture.ledger.writes != 0 {
		t.Fatal("a scopeless call must reach no ledger write")
	}
}

// --- the [G3][G7] closed reason set -------------------------------------------------

func TestEntryReasonsAreAClosedSetWithNoLoginBonus(t *testing.T) {
	t.Parallel()

	// The whole set, enumerated with its classification. A twelfth reason fails this test, which is
	// what makes "one plan owns the set" enforceable rather than merely documented ([G7]).
	classification := map[EntryReason]struct {
		spend         bool
		smallEligible bool
	}{
		ReasonDailyGrant:       {spend: false, smallEligible: false},
		ReasonWriteDiary:       {spend: false, smallEligible: false},
		ReasonInvite:           {spend: false, smallEligible: false},
		ReasonInviteSignup:     {spend: false, smallEligible: false},
		ReasonSignupBonus:      {spend: false, smallEligible: false},
		ReasonAchievementClaim: {spend: false, smallEligible: false},
		ReasonAdminGrant:       {spend: false, smallEligible: false},
		ReasonPayment:          {spend: false, smallEligible: false},
		ReasonRecall:           {spend: true, smallEligible: true},
		ReasonGistView:         {spend: true, smallEligible: true},
		ReasonOrnamentPurchase: {spend: true, smallEligible: false},
	}
	if len(classification) != 11 {
		t.Fatalf("the reason set has %d members, want exactly 11 — a new reason belongs to plan 66 alone", len(classification))
	}
	for reason, want := range classification {
		if got := reason.IsSpend(); got != want.spend {
			t.Fatalf("%q.IsSpend() = %v, want %v", reason, got, want.spend)
		}
		if got := reason.SmallEligible(); got != want.smallEligible {
			t.Fatalf("%q.SmallEligible() = %v, want %v", reason, got, want.smallEligible)
		}
		// [G3]: no login/attendance reason exists anywhere in the set — the daily SMALL reset plays
		// that role by design, and admin_grant is a discretionary gift, not a recurring bonus.
		lowered := strings.ToLower(string(reason))
		if strings.Contains(lowered, "login") || strings.Contains(lowered, "attendance") ||
			strings.Contains(lowered, "streak") || strings.Contains(lowered, "checkin") {
			t.Fatalf("reason %q smells like a login/attendance bonus — [G3] forbids it", reason)
		}
	}
	// An unlisted reason classifies as an earn that cannot touch SMALL — fail-closed in both answers.
	unknown := EntryReason("some_future_reason")
	if unknown.IsSpend() || unknown.SmallEligible() || unknown.SpendKind() != "" {
		t.Fatal("an unlisted reason must classify fail-closed")
	}
}

func TestDailyGrantAndPaymentAreReachableFromNoEntryPoint(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	ctx := context.Background()
	scope := twinkleScope(t, "user-1")

	// A9/A13: the guard is the ABSENT METHOD. There is no exported Earn(reason, amount), so the only
	// way to reach the ledger is through the six named entry points — and none of them can be talked
	// into writing either of these two reasons. Exercise every one of them, then assert.
	if err := fixture.service.EarnOnWrite(ctx, scope, fixture.ledger, "diary-1"); err != nil {
		t.Fatalf("EarnOnWrite failed: %v", err)
	}
	if _, err := fixture.service.EarnSignupBonus(ctx, scope); err != nil {
		t.Fatalf("EarnSignupBonus failed: %v", err)
	}
	if _, err := fixture.service.EarnAchievementReward(ctx, scope, "claim-1", 30); err != nil {
		t.Fatalf("EarnAchievementReward failed: %v", err)
	}
	if _, err := fixture.service.EarnAdminGrant(ctx, scope, 40, "grant-1"); err != nil {
		t.Fatalf("EarnAdminGrant failed: %v", err)
	}
	if err := fixture.service.CheckAndSpend(ctx, scope, fixture.ledger, GistViewSpendIntent(1, "gv-1")); err != nil {
		t.Fatalf("CheckAndSpend failed: %v", err)
	}
	if err := fixture.service.CheckAndSpend(ctx, scope, fixture.ledger, PurchaseSpendIntent(20, "buy-1")); err != nil {
		t.Fatalf("CheckAndSpend(purchase) failed: %v", err)
	}
	fixture.resolver.claims[inviteResolutionKey("code", "friend")] = ResolvedSignup{
		SignupID: "signup-1", InviterUserID: "user-1", InviteeUserID: "friend",
	}
	if _, err := fixture.service.ClaimInvite(ctx, twinkleScope(t, "friend"), "code"); err != nil {
		t.Fatalf("ClaimInvite failed: %v", err)
	}

	if len(fixture.ledger.entries) == 0 {
		t.Fatal("the sweep wrote nothing — the assertion below would be vacuous")
	}
	for _, recorded := range fixture.ledger.entries {
		switch recorded.entry.Reason {
		case ReasonDailyGrant:
			t.Fatal("a daily_grant row was written — the refill is a derivation, never an event ([G7][T4])")
		case ReasonPayment:
			t.Fatal("a payment row was written — payment is deferred to v3 and has no write path")
		}
	}
}

// --- the purchase debit ([P9]) --------------------------------------------------------

func TestPurchaseSpendDrawsGeneralOnlyAndJoinsTheCallersTransaction(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// A full SMALL allowance and enough GENERAL: the purchase must ignore SMALL entirely.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 200, 0); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, PurchaseSpendIntent(60, "purchase:op-1")); err != nil {
		t.Fatalf("CheckAndSpend(purchase) failed: %v", err)
	}
	entries := fixture.ledger.userEntries("user-1")
	entry := entries[len(entries)-1]
	if entry.Reason != ReasonOrnamentPurchase || entry.Kind != EntryKindSpend || entry.Amount != 60 {
		t.Fatalf("entry = %+v, want a 60 ornament_purchase spend", entry)
	}
	if entry.FromSmall != 0 || entry.FromGeneral != 60 {
		t.Fatalf("split = {small %d, general %d}, want GENERAL-only {0, 60} ([P9])", entry.FromSmall, entry.FromGeneral)
	}
	record := fixture.ledger.records["user-1"]
	if record.General != 140 || record.SmallSpentThisWindow != 0 {
		t.Fatalf("record = %+v, want GENERAL debited and the SMALL window untouched", record)
	}
	// The caller's transaction carries it: the gate opened none of its own.
	if fixture.ledger.txCount != 0 {
		t.Fatalf("own transactions = %d, want 0 — a purchase commits with the Decorate that caused it", fixture.ledger.txCount)
	}
	// A replayed purchase (same dedup key) applies no second debit.
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, PurchaseSpendIntent(60, "purchase:op-1")); err != nil {
		t.Fatalf("replayed purchase failed: %v", err)
	}
	if fixture.ledger.records["user-1"].General != 140 {
		t.Fatal("a replayed purchase debited twice")
	}

	// A purchase has no price of its own to fall back on: a non-positive total is a wiring fault.
	for _, amount := range []int{0, -1} {
		if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, PurchaseSpendIntent(amount, "bad")); !errors.Is(err, ErrPurchaseAmountInvalid) {
			t.Fatalf("PurchaseSpendIntent(%d) err = %v, want ErrPurchaseAmountInvalid", amount, err)
		}
	}
}

func TestInsufficiencyIsTypedAndKindAware(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// GENERAL 10, SMALL full: a 60 purchase is short by 50 even though the total balance covers it —
	// which is exactly the [G5] protection the two kinds exist for.
	if _, err := fixture.ledger.ApplyBalanceDelta(context.Background(), scope, twinkleToday(), 10, 0); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	writesBefore := fixture.ledger.writes

	err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, PurchaseSpendIntent(60, "buy"))
	if !errors.Is(err, ErrInsufficientTwinkle) {
		t.Fatalf("err = %v, want it to satisfy errors.Is(ErrInsufficientTwinkle)", err)
	}
	var denial *InsufficientTwinkle
	if !errors.As(err, &denial) {
		t.Fatalf("err = %v, want a *InsufficientTwinkle carrying the arithmetic", err)
	}
	if denial.Cost != 60 || denial.Eligible != 10 || denial.Shortfall != 50 {
		t.Fatalf("denial = %+v, want {60, 10, 50} — GENERAL alone is eligible for a purchase", *denial)
	}
	if got := denial.Detail(); got["cost"] != "60" || got["eligible"] != "10" || got["shortfall"] != "50" {
		t.Fatalf("Detail() = %v, want the three figures as strings", got)
	}
	if fixture.ledger.writes != writesBefore {
		t.Fatal("a refused spend must write nothing")
	}

	// The same balance, priced for a recall: SMALL counts, so eligible is both kinds.
	fixture.signals.recall["m1"] = 0
	if err := fixture.service.CheckAndSpend(context.Background(), scope, fixture.ledger, RecallSpendIntent(0, "r")); err != nil {
		t.Fatalf("a recall at the same balance was refused: %v", err)
	}
}

// --- the new earn entry points ---------------------------------------------------------

func TestEarnAchievementRewardCreditsGeneralOncePerClaim(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")

	for range 2 {
		balance, err := fixture.service.EarnAchievementReward(context.Background(), scope, "claim-7", 120)
		if err != nil {
			t.Fatalf("EarnAchievementReward failed: %v", err)
		}
		if balance.General != 120 {
			t.Fatalf("general = %d, want one 120 reward", balance.General)
		}
	}
	entries := fixture.ledger.userEntries("user-1")
	if len(entries) != 1 || entries[0].Reason != ReasonAchievementClaim || entries[0].Kind != EntryKindEarn ||
		entries[0].DedupKey == nil || *entries[0].DedupKey != "achievement:claim-7" {
		t.Fatalf("entries = %+v, want one achievement_claim earn keyed by the claim", entries)
	}
	if fixture.ledger.records["user-1"].SmallSpentThisWindow != 0 {
		t.Fatal("the reward touched the SMALL window — SMALL is never earned ([G2])")
	}
	// It is a credit primitive: it decides no eligibility, only that the inputs could be a reward.
	if _, err := fixture.service.EarnAchievementReward(context.Background(), scope, "  ", 10); !errors.Is(err, ErrRewardClaimRequired) {
		t.Fatalf("blank claim id err = %v, want ErrRewardClaimRequired", err)
	}
	if _, err := fixture.service.EarnAchievementReward(context.Background(), scope, "claim-8", 0); !errors.Is(err, ErrGrantAmountInvalid) {
		t.Fatalf("zero reward err = %v, want ErrGrantAmountInvalid", err)
	}
}

func TestClaimInviteSplitsTheTwoLegsByReason(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	invitee := twinkleScope(t, "friend-1")
	fixture.resolver.claims[inviteResolutionKey("code", "friend-1")] = ResolvedSignup{
		SignupID: "signup-1", InviterUserID: "inviter-1", InviteeUserID: "friend-1",
	}

	if _, err := fixture.service.ClaimInvite(context.Background(), invitee, "code"); err != nil {
		t.Fatalf("ClaimInvite failed: %v", err)
	}
	inviter := fixture.ledger.userEntries("inviter-1")
	if len(inviter) != 1 || inviter[0].Reason != ReasonInvite ||
		inviter[0].DedupKey == nil || *inviter[0].DedupKey != "invite:signup-1" {
		t.Fatalf("inviter entries = %+v, want one `invite` row keyed invite:signup-1", inviter)
	}
	friend := fixture.ledger.userEntries("friend-1")
	if len(friend) != 1 || friend[0].Reason != ReasonInviteSignup ||
		friend[0].DedupKey == nil || *friend[0].DedupKey != "invite_signup:signup-1" {
		t.Fatalf("invitee entries = %+v, want one `invite_signup` row keyed invite_signup:signup-1", friend)
	}
}

// --- the history read ([G7]) -----------------------------------------------------------

func TestGetLedgerPagesNewestFirstWithinTheCap(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	base := twinkleNow()
	for index := range 5 {
		key := fmt.Sprintf("k%d", index)
		fixture.ledger.entries = append(fixture.ledger.entries, recordedEntry{
			userID: "user-1",
			entry: LedgerEntry{
				ID: fmt.Sprintf("entry-%d", index), Kind: EntryKindEarn, Reason: ReasonWriteDiary,
				Amount: 10, DedupKey: &key, CreatedAt: base.Add(time.Duration(index) * time.Minute),
			},
		})
	}

	first, err := fixture.service.GetLedger(context.Background(), scope, 2, "")
	if err != nil {
		t.Fatalf("GetLedger failed: %v", err)
	}
	if len(first.Entries) != 2 || first.Entries[0].Entry.ID != "entry-4" || first.Entries[1].Entry.ID != "entry-3" {
		t.Fatalf("page 1 = %+v, want the two newest", first.Entries)
	}
	if first.NextPageToken == "" {
		t.Fatal("page 1 has no next token but the history continues")
	}
	second, err := fixture.service.GetLedger(context.Background(), scope, 2, first.NextPageToken)
	if err != nil {
		t.Fatalf("GetLedger(page 2) failed: %v", err)
	}
	if len(second.Entries) != 2 || second.Entries[0].Entry.ID != "entry-2" {
		t.Fatalf("page 2 = %+v, want the next two with no overlap", second.Entries)
	}
	last, err := fixture.service.GetLedger(context.Background(), scope, 2, second.NextPageToken)
	if err != nil {
		t.Fatalf("GetLedger(page 3) failed: %v", err)
	}
	if len(last.Entries) != 1 || last.NextPageToken != "" {
		t.Fatalf("page 3 = %+v (next %q), want the last row and no token", last.Entries, last.NextPageToken)
	}

	// The cap is the default AND the ceiling: asking for more than the page size gets the page size.
	full, err := fixture.service.GetLedger(context.Background(), scope, values.TwinkleLedgerPageSize+500, "")
	if err != nil {
		t.Fatalf("GetLedger(oversized) failed: %v", err)
	}
	if len(full.Entries) != 5 {
		t.Fatalf("oversized page returned %d entries, want all 5 (clamped, not refused)", len(full.Entries))
	}

	// A fabricated token is refused rather than silently restarting the history.
	if _, err := fixture.service.GetLedger(context.Background(), scope, 0, "not-a-cursor!!"); !errors.Is(err, ErrLedgerCursorInvalid) {
		t.Fatalf("bad token err = %v, want ErrLedgerCursorInvalid", err)
	}
}

func TestGetLedgerResolvesTheDayInTheUsersZone(t *testing.T) {
	t.Parallel()
	fixture := newTwinkleFixture(t)
	scope := twinkleScope(t, "user-1")
	// 2026-07-14T23:00Z is still the 14th in UTC and already the 15th in Seoul. The history's day
	// header must agree with the user's own SMALL reset boundary, not the server's ([U7]).
	key := "k"
	fixture.ledger.entries = append(fixture.ledger.entries, recordedEntry{
		userID: "user-1",
		entry: LedgerEntry{
			ID: "entry-1", Kind: EntryKindEarn, Reason: ReasonSignupBonus, Amount: 500,
			DedupKey: &key, CreatedAt: time.Date(2026, 7, 14, 23, 0, 0, 0, time.UTC),
		},
	})

	page, err := fixture.service.GetLedger(context.Background(), scope, 0, "")
	if err != nil {
		t.Fatalf("GetLedger failed: %v", err)
	}
	if got := page.Entries[0].OccurredOn.Format(time.DateOnly); got != "2026-07-14" {
		t.Fatalf("occurred_on (UTC user) = %s, want 2026-07-14", got)
	}
	fixture.zones.names["user-1"] = "Asia/Seoul"
	page, err = fixture.service.GetLedger(context.Background(), scope, 0, "")
	if err != nil {
		t.Fatalf("GetLedger(Seoul) failed: %v", err)
	}
	if got := page.Entries[0].OccurredOn.Format(time.DateOnly); got != "2026-07-15" {
		t.Fatalf("occurred_on (Seoul user) = %s, want 2026-07-15", got)
	}
}
