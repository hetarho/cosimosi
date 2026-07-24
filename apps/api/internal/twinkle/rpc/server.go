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
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
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
		return "", "", 0, apperr.Domain(connect.CodeInvalidArgument, reasonQuoteInputRequired, twinkle.ErrQuoteInputRequired, nil)
	}
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, twinkle.ErrInviteInputRequired):
		return apperr.Domain(connect.CodeInvalidArgument, reasonInviteInputRequired, err, nil)
	case errors.Is(err, twinkle.ErrChargeInputRequired):
		return apperr.Domain(connect.CodeInvalidArgument, reasonChargeInputRequired, err, nil)
	case errors.Is(err, twinkle.ErrQuoteInputRequired):
		return apperr.Domain(connect.CodeInvalidArgument, reasonQuoteInputRequired, err, nil)
	case errors.Is(err, twinkle.ErrQuoteTargetNotFound):
		return apperr.Domain(connect.CodeNotFound, reasonQuoteTargetNotFound, err, nil)
	case errors.Is(err, twinkle.ErrInsufficientTwinkle):
		return apperr.Domain(connect.CodeResourceExhausted, reasonInsufficient, err, nil)
	case errors.Is(err, twinkle.ErrPaymentVerificationUnavailable):
		return apperr.Domain(connect.CodeUnavailable, reasonPaymentVerificationUnavailable, err, nil)
	case errors.Is(err, twinkle.ErrInviteResolutionUnavailable):
		return apperr.Domain(connect.CodeUnavailable, reasonInviteResolutionUnavailable, err, nil)
	case errors.Is(err, twinkle.ErrPaymentBeneficiaryMismatch):
		return apperr.Domain(connect.CodePermissionDenied, reasonPaymentBeneficiaryMismatch, err, nil)
	case errors.Is(err, twinkle.ErrInviteBeneficiaryMismatch):
		return apperr.Domain(connect.CodePermissionDenied, reasonInviteBeneficiaryMismatch, err, nil)
	case errors.Is(err, twinkle.ErrInviteNotEligible):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonInviteNotEligible, err, nil)
	case errors.Is(err, twinkle.ErrInviteGrantConflict):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonInviteGrantConflict, err, nil)
	case errors.Is(err, twinkle.ErrPaymentNotVerified):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonPaymentNotVerified, err, nil)
	case errors.Is(err, twinkle.ErrQuoteTargetUnavailable):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonQuoteTargetUnavailable, err, nil)
	case errors.Is(err, twinkle.ErrScopeRequired):
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	default:
		return apperr.Internal(err)
	}
}
