// Package rpc is the twinkle context's transport adapter: thin Connect handlers
// that map proto DTOs to domain inputs and call the use-cases (ARCHITECTURE
// §2.7/§2.9#7). No policy lives here — pricing, spend order, earn reasons,
// idempotency, and trusted-claim validation all live in the use-case/domain.
package rpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/twinkle"
)

var ErrServiceRequired = errors.New("twinkle rpc server requires the twinkle service")

type Server struct {
	service *twinkle.Service
}

func NewServer(service *twinkle.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) GetBalance(ctx context.Context, _ *connect.Request[twinklev1.GetBalanceRequest]) (*connect.Response[twinklev1.GetBalanceResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	balance, err := s.service.GetBalance(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&twinklev1.GetBalanceResponse{
		Small:   int64(balance.Small),
		General: int64(balance.General),
		Total:   int64(balance.Total()),
	}), nil
}

func (s *Server) QuoteSpend(ctx context.Context, req *connect.Request[twinklev1.QuoteSpendRequest]) (*connect.Response[twinklev1.QuoteSpendResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	kind, targetID, err := quoteTarget(req.Msg)
	if err != nil {
		return nil, err
	}
	quote, err := s.service.QuoteSpend(ctx, scope, kind, targetID)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&twinklev1.QuoteSpendResponse{
		Cost:      int64(quote.Cost),
		Covered:   quote.Covered,
		Shortfall: int64(quote.Shortfall),
	}), nil
}

// GetLedger returns one keyset page of the caller's history ([G7]). Thin: clamp nothing, decide
// nothing — the use-case owns the page size cap, the cursor and the timezone the dates are resolved in.
func (s *Server) GetLedger(ctx context.Context, req *connect.Request[twinklev1.GetLedgerRequest]) (*connect.Response[twinklev1.GetLedgerResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	page, err := s.service.GetLedger(ctx, scope, int(req.Msg.GetPageSize()), req.Msg.GetPageToken())
	if err != nil {
		return nil, domainError(err)
	}
	entries := make([]*twinklev1.LedgerEntry, 0, len(page.Entries))
	for _, view := range page.Entries {
		entries = append(entries, &twinklev1.LedgerEntry{
			Id:          view.Entry.ID,
			Kind:        ledgerEntryKind(view.Entry.Kind),
			Reason:      ledgerEntryReason(view.Entry.Reason),
			Amount:      int64(view.Entry.Amount),
			FromSmall:   int64(view.Entry.FromSmall),
			FromGeneral: int64(view.Entry.FromGeneral),
			OccurredOn:  view.OccurredOn.Format(time.DateOnly),
			OccurredAt:  view.Entry.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return connect.NewResponse(&twinklev1.GetLedgerResponse{
		Entries:       entries,
		NextPageToken: page.NextPageToken,
	}), nil
}

// ledgerEntryKind / ledgerEntryReason are the domain→proto half of the anti-corruption boundary. Both
// map an unknown value to UNSPECIFIED rather than guessing: a row written by a newer server must
// render as "something happened" in an older client, never as the wrong thing.
func ledgerEntryKind(kind twinkle.EntryKind) twinklev1.LedgerEntryKind {
	switch kind {
	case twinkle.EntryKindEarn:
		return twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_EARN
	case twinkle.EntryKindSpend:
		return twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_SPEND
	default:
		return twinklev1.LedgerEntryKind_LEDGER_ENTRY_KIND_UNSPECIFIED
	}
}

// daily_grant is absent on purpose: it is never written, and the wire enum has no member for it.
func ledgerEntryReason(reason twinkle.EntryReason) twinklev1.LedgerEntryReason {
	switch reason {
	case twinkle.ReasonWriteDiary:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_WRITE_DIARY
	case twinkle.ReasonInvite:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_INVITE
	case twinkle.ReasonInviteSignup:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_INVITE_SIGNUP
	case twinkle.ReasonSignupBonus:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_SIGNUP_BONUS
	case twinkle.ReasonAchievementClaim:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ACHIEVEMENT_CLAIM
	case twinkle.ReasonAdminGrant:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ADMIN_GRANT
	case twinkle.ReasonRecall:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_RECALL
	case twinkle.ReasonGistView:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_GIST_VIEW
	case twinkle.ReasonOrnamentPurchase:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_ORNAMENT_PURCHASE
	case twinkle.ReasonPayment:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_PAYMENT
	default:
		return twinklev1.LedgerEntryReason_LEDGER_ENTRY_REASON_UNSPECIFIED
	}
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}

// quoteTarget maps the wire kind + its target field onto the domain quote input:
// recall/gist-view quote an episodic memory, the diary batch quotes a diary.
func quoteTarget(msg *twinklev1.QuoteSpendRequest) (twinkle.SpendKind, string, error) {
	switch msg.GetKind() {
	case twinklev1.SpendKind_SPEND_KIND_RECALL:
		return twinkle.SpendKindRecall, msg.GetEpisodicMemoryId(), nil
	case twinklev1.SpendKind_SPEND_KIND_GIST_VIEW:
		return twinkle.SpendKindGistView, msg.GetEpisodicMemoryId(), nil
	case twinklev1.SpendKind_SPEND_KIND_DIARY_RECALL:
		return twinkle.SpendKindDiaryRecall, msg.GetDiaryId(), nil
	default:
		return "", "", apperr.Domain(connect.CodeInvalidArgument, reasonQuoteInputRequired, twinkle.ErrQuoteInputRequired, nil)
	}
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, twinkle.ErrInviteInputRequired):
		return apperr.Domain(connect.CodeInvalidArgument, reasonInviteInputRequired, err, nil)
	case errors.Is(err, twinkle.ErrQuoteInputRequired):
		return apperr.Domain(connect.CodeInvalidArgument, reasonQuoteInputRequired, err, nil)
	case errors.Is(err, twinkle.ErrQuoteTargetNotFound):
		return apperr.Domain(connect.CodeNotFound, reasonQuoteTargetNotFound, err, nil)
	case errors.Is(err, twinkle.ErrLedgerCursorInvalid):
		return apperr.Domain(connect.CodeInvalidArgument, reasonLedgerCursorInvalid, err, nil)
	case errors.Is(err, twinkle.ErrInsufficientTwinkle):
		// The denial carries its own arithmetic when it has any ([P8]): how much, and how much of it
		// this purpose could actually pay with. The consumer names the item; twinkle names the numbers.
		var insufficient *twinkle.InsufficientTwinkle
		if errors.As(err, &insufficient) {
			return apperr.Domain(connect.CodeResourceExhausted, reasonInsufficient, err, insufficient.Detail())
		}
		return apperr.Domain(connect.CodeResourceExhausted, reasonInsufficient, err, nil)
	case errors.Is(err, twinkle.ErrInviteResolutionUnavailable):
		return apperr.Domain(connect.CodeUnavailable, reasonInviteResolutionUnavailable, err, nil)
	case errors.Is(err, twinkle.ErrInviteBeneficiaryMismatch):
		return apperr.Domain(connect.CodePermissionDenied, reasonInviteBeneficiaryMismatch, err, nil)
	case errors.Is(err, twinkle.ErrInviteNotEligible):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonInviteNotEligible, err, nil)
	case errors.Is(err, twinkle.ErrInviteGrantConflict):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonInviteGrantConflict, err, nil)
	case errors.Is(err, twinkle.ErrQuoteTargetUnavailable):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonQuoteTargetUnavailable, err, nil)
	case errors.Is(err, twinkle.ErrScopeRequired):
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	default:
		return apperr.Internal(err)
	}
}
