package rpc

import (
	"context"
	"errors"
	"strings"
	"testing"

	"connectrpc.com/connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/twinkle"
)

func TestHandlersRejectUnauthenticatedRequestsBeforeAnyWork(t *testing.T) {
	t.Parallel()
	server := &Server{}
	token := "private-cursor-token"

	_, ledgerErr := server.GetLedger(context.Background(), connect.NewRequest(&twinklev1.GetLedgerRequest{
		PageSize:  10,
		PageToken: token,
	}))
	if connect.CodeOf(ledgerErr) != connect.CodeUnauthenticated {
		t.Fatalf("GetLedger code = %v, want unauthenticated", connect.CodeOf(ledgerErr))
	}
	if strings.Contains(ledgerErr.Error(), token) {
		t.Fatal("the unauthenticated GetLedger error echoed the caller's page token")
	}

	_, balanceErr := server.GetBalance(context.Background(), connect.NewRequest(&twinklev1.GetBalanceRequest{}))
	if connect.CodeOf(balanceErr) != connect.CodeUnauthenticated {
		t.Fatalf("GetBalance code = %v, want unauthenticated", connect.CodeOf(balanceErr))
	}
	_, quoteErr := server.QuoteSpend(context.Background(), connect.NewRequest(&twinklev1.QuoteSpendRequest{
		Kind:             twinklev1.SpendKind_SPEND_KIND_RECALL,
		EpisodicMemoryId: "m1",
	}))
	if connect.CodeOf(quoteErr) != connect.CodeUnauthenticated {
		t.Fatalf("QuoteSpend code = %v, want unauthenticated", connect.CodeOf(quoteErr))
	}
}

// The proto→domain enum mappers are total and fail SOFT: a reason a newer server writes must render
// as "something happened" in an older client, never as the wrong caption. daily_grant has no wire
// value at all, so it maps to UNSPECIFIED like anything else unlisted ([G7]).
func TestLedgerEnumMappersAreTotalAndMapUnknownsToUnspecified(t *testing.T) {
	t.Parallel()
	reasons := map[twinkle.EntryReason]twinklev1.LedgerEntryReason{
		twinkle.ReasonWriteDiary:       twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_WRITE_DIARY,
		twinkle.ReasonInvite:           twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_INVITE,
		twinkle.ReasonInviteSignup:     twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_INVITE_SIGNUP,
		twinkle.ReasonSignupBonus:      twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_SIGNUP_BONUS,
		twinkle.ReasonAchievementClaim: twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ACHIEVEMENT_CLAIM,
		twinkle.ReasonAdminGrant:       twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ADMIN_GRANT,
		twinkle.ReasonRecall:           twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_RECALL,
		twinkle.ReasonGistView:         twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_GIST_VIEW,
		twinkle.ReasonOrnamentPurchase: twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ORNAMENT_PURCHASE,
		twinkle.ReasonPayment:          twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_PAYMENT,
		twinkle.ReasonDailyGrant:       twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_UNSPECIFIED,
		twinkle.EntryReason("later"):   twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_UNSPECIFIED,
	}
	for reason, want := range reasons {
		if got := ledgerEntryReason(reason); got != want {
			t.Fatalf("ledgerEntryReason(%q) = %v, want %v", reason, got, want)
		}
	}
	kinds := map[twinkle.EntryKind]twinklev1.LedgerEntryKind{
		twinkle.EntryKindEarn:      twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_EARN,
		twinkle.EntryKindSpend:     twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_SPEND,
		twinkle.EntryKind("later"): twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_UNSPECIFIED,
	}
	for kind, want := range kinds {
		if got := ledgerEntryKind(kind); got != want {
			t.Fatalf("ledgerEntryKind(%q) = %v, want %v", kind, got, want)
		}
	}
}

func TestDomainErrorMapsTrustBoundaryRefusals(t *testing.T) {
	t.Parallel()
	cases := []struct {
		err        error
		wantCode   connect.Code
		wantReason string
	}{
		{twinkle.ErrInviteInputRequired, connect.CodeInvalidArgument, reasonInviteInputRequired},
		{twinkle.ErrQuoteInputRequired, connect.CodeInvalidArgument, reasonQuoteInputRequired},
		{twinkle.ErrLedgerCursorInvalid, connect.CodeInvalidArgument, reasonLedgerCursorInvalid},
		{twinkle.ErrQuoteTargetNotFound, connect.CodeNotFound, reasonQuoteTargetNotFound},
		{twinkle.ErrInsufficientTwinkle, connect.CodeResourceExhausted, reasonInsufficient},
		{twinkle.ErrInviteResolutionUnavailable, connect.CodeUnavailable, reasonInviteResolutionUnavailable},
		{twinkle.ErrInviteBeneficiaryMismatch, connect.CodePermissionDenied, reasonInviteBeneficiaryMismatch},
		{twinkle.ErrInviteNotEligible, connect.CodeFailedPrecondition, reasonInviteNotEligible},
		{twinkle.ErrInviteGrantConflict, connect.CodeFailedPrecondition, reasonInviteGrantConflict},
		{twinkle.ErrQuoteTargetUnavailable, connect.CodeFailedPrecondition, reasonQuoteTargetUnavailable},
		{twinkle.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
	}
	for _, test := range cases {
		got := domainError(test.err)
		if gotCode := connect.CodeOf(got); gotCode != test.wantCode {
			t.Fatalf("domainError(%v) code = %v, want %v", test.err, gotCode, test.wantCode)
		}
		info, ok := apperr.Info(got)
		if !ok || info.GetReason() != test.wantReason || info.GetDomain() != "twinkle" {
			t.Fatalf("domainError(%v) info = %#v, want reason %q", test.err, info, test.wantReason)
		}
	}
	other := errors.New("boom")
	got := domainError(other)
	info, ok := apperr.Info(got)
	if connect.CodeOf(got) != connect.CodeInternal || !ok || info.GetReason() != apperr.ReasonInternal || !errors.Is(got, other) {
		t.Fatalf("unknown error should be internal and retain its cause, got %v", got)
	}
}

// A typed denial reaches the client as metadata, not as a parsed error string ([P8]): the consumer
// needs the numbers to say "얼마 모자라요", and a message it has to parse would be a second contract.
func TestInsufficiencyDetailRidesTheMetadataChannel(t *testing.T) {
	t.Parallel()

	err := domainError(&twinkle.InsufficientTwinkle{Cost: 60, Eligible: 10, Shortfall: 50})
	if connect.CodeOf(err) != connect.CodeResourceExhausted {
		t.Fatalf("code = %v, want resource-exhausted", connect.CodeOf(err))
	}
	info, ok := apperr.Info(err)
	if !ok || info.GetReason() != reasonInsufficient {
		t.Fatalf("info = %#v, want reason %q", info, reasonInsufficient)
	}
	metadata := info.GetMetadata()
	if metadata["cost"] != "60" || metadata["eligible"] != "10" || metadata["shortfall"] != "50" {
		t.Fatalf("metadata = %v, want the three figures", metadata)
	}
	// The bare sentinel still maps — a denial without arithmetic is not a broken denial.
	if _, ok := apperr.Info(domainError(twinkle.ErrInsufficientTwinkle)); !ok {
		t.Fatal("the bare insufficient sentinel lost its reason")
	}
}
