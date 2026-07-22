// Package rpc is the twinkle context's transport adapter: thin Connect handlers
// that map proto DTOs to domain inputs and call the use-cases (ARCHITECTURE
// §2.7/§2.9#7). No policy lives here — pricing, spend order, earn reasons,
// idempotency, and trusted-claim validation all live in the use-case/domain.
package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	twinklev1 "github.com/cosimosi/api/internal/gen/cosimosi/twinkle/v1"
	"github.com/cosimosi/api/internal/platform"
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
		Basic:      int64(balance.Basic),
		Additional: int64(balance.Additional),
		Total:      int64(balance.Total()),
	}), nil
}

func (s *Server) QuoteSpend(ctx context.Context, req *connect.Request[twinklev1.QuoteSpendRequest]) (*connect.Response[twinklev1.QuoteSpendResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	kind, targetID, semanticStage, err := quoteTarget(req.Msg)
	if err != nil {
		return nil, err
	}
	quote, err := s.service.QuoteSpend(ctx, scope, kind, targetID, semanticStage)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&twinklev1.QuoteSpendResponse{
		Cost:      int64(quote.Cost),
		Covered:   quote.Covered,
		Shortfall: int64(quote.Shortfall),
	}), nil
}

func (s *Server) ClaimInvite(ctx context.Context, req *connect.Request[twinklev1.ClaimInviteRequest]) (*connect.Response[twinklev1.ClaimInviteResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	balance, err := s.service.ClaimInvite(ctx, scope, req.Msg.GetInviteCode())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&twinklev1.ClaimInviteResponse{
		BalanceTotal: int64(balance.Total()),
	}), nil
}

func (s *Server) Charge(ctx context.Context, req *connect.Request[twinklev1.ChargeRequest]) (*connect.Response[twinklev1.ChargeResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	balance, err := s.service.Charge(ctx, scope, req.Msg.GetPackId(), req.Msg.GetPlatform(), req.Msg.GetReceipt())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&twinklev1.ChargeResponse{
		BalanceTotal: int64(balance.Total()),
	}), nil
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, connect.NewError(connect.CodeUnauthenticated, err)
	}
	return scope, nil
}

// quoteTarget maps the wire kind + its target field onto the domain quote input:
// recall/gist-view quote an episodic memory, the diary batch quotes a diary.
func quoteTarget(msg *twinklev1.QuoteSpendRequest) (twinkle.QuoteKind, string, int, error) {
	switch msg.GetKind() {
	case twinklev1.SpendKind_SPEND_KIND_RECALL:
		return twinkle.QuoteKindRecall, msg.GetEpisodicMemoryId(), 0, nil
	case twinklev1.SpendKind_SPEND_KIND_GIST_VIEW:
		return twinkle.QuoteKindGistView, msg.GetEpisodicMemoryId(), int(msg.GetSemanticStage()), nil
	case twinklev1.SpendKind_SPEND_KIND_DIARY_RECALL:
		return twinkle.QuoteKindDiaryRecall, msg.GetDiaryId(), 0, nil
	default:
		return "", "", 0, connect.NewError(connect.CodeInvalidArgument, twinkle.ErrQuoteInputRequired)
	}
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, twinkle.ErrInviteInputRequired),
		errors.Is(err, twinkle.ErrChargeInputRequired),
		errors.Is(err, twinkle.ErrQuoteInputRequired):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, twinkle.ErrQuoteTargetNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, twinkle.ErrInsufficientTwinkle):
		return connect.NewError(connect.CodeResourceExhausted, err)
	case errors.Is(err, twinkle.ErrPaymentVerificationUnavailable),
		errors.Is(err, twinkle.ErrInviteResolutionUnavailable):
		return connect.NewError(connect.CodeUnavailable, err)
	case errors.Is(err, twinkle.ErrPaymentBeneficiaryMismatch),
		errors.Is(err, twinkle.ErrInviteBeneficiaryMismatch):
		return connect.NewError(connect.CodePermissionDenied, err)
	case errors.Is(err, twinkle.ErrInviteNotEligible),
		errors.Is(err, twinkle.ErrInviteGrantConflict),
		errors.Is(err, twinkle.ErrPaymentNotVerified),
		errors.Is(err, twinkle.ErrQuoteTargetUnavailable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, twinkle.ErrScopeRequired):
		return connect.NewError(connect.CodeUnauthenticated, err)
	default:
		return err
	}
}
