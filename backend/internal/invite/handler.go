package invite

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// Handler adapts proto ↔ domain for BOTH invite services. One struct implements:
//   - InviteServiceHandler      (authenticated, NO membership) — the gate-passing surface.
//   - InviteAdminServiceHandler (authenticated + admin allowlist) — issue/list/revoke.
//
// They share the Service; the auth/membership/admin boundary is enforced by the interceptor
// chain each service is MOUNTED with (rpcserver), not here (the spec-35 share/visit precedent).
// Thin: mapping + error translation only; policy lives in Service.
type Handler struct {
	cosimosiv1connect.UnimplementedInviteServiceHandler
	cosimosiv1connect.UnimplementedInviteAdminServiceHandler
	svc *Service
	// adminUserIDs mirrors ADMIN_USER_IDS — admins are members without redeeming (spec 41), so
	// GetMembershipStatus reports them as members and the FE gate never routes them to /invite.
	adminUserIDs []string
}

// NewHandler builds the Connect handler over the invite service. adminUserIDs is the admin
// allowlist (admins bypass the membership gate — same exemption the server interceptor applies).
func NewHandler(svc *Service, adminUserIDs []string) *Handler {
	return &Handler{svc: svc, adminUserIDs: adminUserIDs}
}

var (
	_ cosimosiv1connect.InviteServiceHandler      = (*Handler)(nil)
	_ cosimosiv1connect.InviteAdminServiceHandler = (*Handler)(nil)
)

// --- InviteService (authenticated, NO membership) ---

func (h *Handler) GetMembershipStatus(ctx context.Context, _ *connect.Request[cosimosiv1.GetMembershipStatusRequest]) (*connect.Response[cosimosiv1.GetMembershipStatusResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	// 관리자는 초대 코드 없이도 멤버다(spec 41) — 서버 멤버십 인터셉터의 면제와 같은 판정.
	if rpcserver.IsAllowlistedAdmin(ctx, h.adminUserIDs) {
		return connect.NewResponse(&cosimosiv1.GetMembershipStatusResponse{IsMember: true}), nil
	}
	member, err := h.svc.MembershipStatus(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.GetMembershipStatusResponse{IsMember: member}), nil
}

func (h *Handler) ValidateInviteCode(ctx context.Context, req *connect.Request[cosimosiv1.ValidateInviteCodeRequest]) (*connect.Response[cosimosiv1.ValidateInviteCodeResponse], error) {
	reason, err := h.svc.Validate(ctx, req.Msg.GetCode(), time.Now())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.ValidateInviteCodeResponse{
		Valid:  reason == ReasonOK,
		Reason: reasonToProto(reason),
	}), nil
}

func (h *Handler) RedeemInviteCode(ctx context.Context, req *connect.Request[cosimosiv1.RedeemInviteCodeRequest]) (*connect.Response[cosimosiv1.RedeemInviteCodeResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	out, err := h.svc.Redeem(ctx, req.Msg.GetCode(), userID, time.Now())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.RedeemInviteCodeResponse{
		Ok:     out.OK(),
		Reason: reasonToProto(out.Reason),
	}), nil
}

// --- InviteAdminService (authenticated + admin allowlist) ---

func (h *Handler) IssueInviteCode(ctx context.Context, req *connect.Request[cosimosiv1.IssueInviteCodeRequest]) (*connect.Response[cosimosiv1.IssueInviteCodeResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	now := time.Now()
	p := IssueParams{Label: req.Msg.GetLabel(), CreatedBy: userID}
	if req.Msg.MaxUses != nil { // proto3 optional — present means an explicit cap
		v := int(req.Msg.GetMaxUses())
		p.MaxUses = &v
	}
	if req.Msg.TtlSeconds != nil {
		d := time.Duration(req.Msg.GetTtlSeconds()) * time.Second
		p.TTL = &d
	}
	c, err := h.svc.Issue(ctx, p, now)
	switch {
	case errors.Is(err, ErrInvalidMaxUses), errors.Is(err, ErrInvalidTTL):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.IssueInviteCodeResponse{Code: toProto(c, now)}), nil
}

func (h *Handler) ListInviteCodes(ctx context.Context, _ *connect.Request[cosimosiv1.ListInviteCodesRequest]) (*connect.Response[cosimosiv1.ListInviteCodesResponse], error) {
	codes, err := h.svc.List(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	now := time.Now()
	out := make([]*cosimosiv1.InviteCode, len(codes))
	for i, c := range codes {
		out[i] = toProto(c, now)
	}
	return connect.NewResponse(&cosimosiv1.ListInviteCodesResponse{Codes: out}), nil
}

func (h *Handler) RevokeInviteCode(ctx context.Context, req *connect.Request[cosimosiv1.RevokeInviteCodeRequest]) (*connect.Response[cosimosiv1.RevokeInviteCodeResponse], error) {
	c, err := h.svc.Revoke(ctx, req.Msg.GetId())
	switch {
	case errors.Is(err, ErrNotFound):
		return nil, connect.NewError(connect.CodeNotFound, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.RevokeInviteCodeResponse{Code: toProto(c, time.Now())}), nil
}

// --- proto mapping ---

// toProto maps a domain code → proto. The orthogonal nils become proto sentinels: max_uses 0 =
// unlimited (the CHECK forbids a real 0), expires_at 0 = never. created/expires are unix seconds.
func toProto(c InviteCode, now time.Time) *cosimosiv1.InviteCode {
	pc := &cosimosiv1.InviteCode{
		Id:        c.ID,
		Code:      c.Code,
		Label:     c.Label,
		CreatedBy: c.CreatedBy,
		CreatedAt: c.CreatedAt.Unix(),
		UsedCount: int32(c.UsedCount),
		Status:    statusToProto(c.Status(now)),
	}
	if c.ExpiresAt != nil {
		pc.ExpiresAt = c.ExpiresAt.Unix()
	}
	if c.MaxUses != nil {
		pc.MaxUses = int32(*c.MaxUses)
	}
	return pc
}

func reasonToProto(r Reason) cosimosiv1.InviteReason {
	switch r {
	case ReasonOK:
		return cosimosiv1.InviteReason_INVITE_REASON_OK
	case ReasonNotFound:
		return cosimosiv1.InviteReason_INVITE_REASON_NOT_FOUND
	case ReasonExpired:
		return cosimosiv1.InviteReason_INVITE_REASON_EXPIRED
	case ReasonExhausted:
		return cosimosiv1.InviteReason_INVITE_REASON_EXHAUSTED
	case ReasonRevoked:
		return cosimosiv1.InviteReason_INVITE_REASON_REVOKED
	default:
		return cosimosiv1.InviteReason_INVITE_REASON_UNSPECIFIED
	}
}

func statusToProto(s Status) cosimosiv1.InviteCodeStatus {
	switch s {
	case StatusActive:
		return cosimosiv1.InviteCodeStatus_INVITE_CODE_STATUS_ACTIVE
	case StatusExpired:
		return cosimosiv1.InviteCodeStatus_INVITE_CODE_STATUS_EXPIRED
	case StatusExhausted:
		return cosimosiv1.InviteCodeStatus_INVITE_CODE_STATUS_EXHAUSTED
	case StatusRevoked:
		return cosimosiv1.InviteCodeStatus_INVITE_CODE_STATUS_REVOKED
	default:
		return cosimosiv1.InviteCodeStatus_INVITE_CODE_STATUS_UNSPECIFIED
	}
}
