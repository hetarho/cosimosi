package gift

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// Handler adapts proto ↔ domain for the GiftService RPCs (spec 36). Every rpc is
// authenticated — user_id comes from the JWT (the auth interceptor runs before this; the
// service scopes every action to the caller). Thin: mapping + error translation only; policy
// lives in Service.
type Handler struct {
	cosimosiv1connect.UnimplementedGiftServiceHandler
	svc *Service
}

// NewHandler builds the Connect handler over the gift service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

var _ cosimosiv1connect.GiftServiceHandler = (*Handler)(nil)

func (h *Handler) SendStarGift(ctx context.Context, req *connect.Request[cosimosiv1.SendStarGiftRequest]) (*connect.Response[cosimosiv1.SendStarGiftResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	token, err := h.svc.SendGift(ctx, userID, req.Msg.GetMemoryId(), req.Msg.GetMessage())
	if err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.SendStarGiftResponse{Token: token}), nil
}

func (h *Handler) GetStarGift(ctx context.Context, req *connect.Request[cosimosiv1.GetStarGiftRequest]) (*connect.Response[cosimosiv1.GetStarGiftResponse], error) {
	if _, err := rpcserver.RequireUserID(ctx); err != nil {
		return nil, err
	}
	v, err := h.svc.GetGift(ctx, req.Msg.GetToken())
	if err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.GetStarGiftResponse{
		Status:            statusToProto(v.Status),
		SenderDisplayName: v.SenderDisplayName,
		Message:           v.Message,
		FragmentText:      v.FragmentText, // "" unless actionable — terminal states reveal no content
		Mood:              rpcserver.MoodToProto(v.Mood),
		ExpiresAt:         formatTime(v.ExpiresAt),
	}), nil
}

func (h *Handler) AcceptStarGift(ctx context.Context, req *connect.Request[cosimosiv1.AcceptStarGiftRequest]) (*connect.Response[cosimosiv1.AcceptStarGiftResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	msg := req.Msg
	res, err := h.svc.AcceptGift(ctx, userID, msg.GetToken(), Rewrite{
		Text:      msg.GetText(),
		Mood:      rpcserver.MoodFromProto(msg.GetMood()),
		Intensity: msg.GetIntensity(),
		Valence:   msg.GetValence(),
	})
	if err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.AcceptStarGiftResponse{
		RecordId: res.RecordID,
		MemoryId: res.MemoryID,
	}), nil
}

func (h *Handler) DeclineStarGift(ctx context.Context, req *connect.Request[cosimosiv1.DeclineStarGiftRequest]) (*connect.Response[cosimosiv1.DeclineStarGiftResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := h.svc.DeclineGift(ctx, userID, req.Msg.GetToken()); err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.DeclineStarGiftResponse{}), nil
}

func (h *Handler) CancelStarGift(ctx context.Context, req *connect.Request[cosimosiv1.CancelStarGiftRequest]) (*connect.Response[cosimosiv1.CancelStarGiftResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := h.svc.CancelGift(ctx, userID, req.Msg.GetGiftId()); err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.CancelStarGiftResponse{}), nil
}

func (h *Handler) ListStarGifts(ctx context.Context, _ *connect.Request[cosimosiv1.ListStarGiftsRequest]) (*connect.Response[cosimosiv1.ListStarGiftsResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	list, err := h.svc.ListGifts(ctx, userID)
	if err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.ListStarGiftsResponse{
		Sent:     toSummaryProtos(list.Sent),
		Received: toSummaryProtos(list.Received),
	}), nil
}

func (h *Handler) GetResonanceInfo(ctx context.Context, req *connect.Request[cosimosiv1.GetResonanceInfoRequest]) (*connect.Response[cosimosiv1.GetResonanceInfoResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	info, err := h.svc.GetResonanceInfo(ctx, userID, req.Msg.GetMemoryId())
	if err != nil {
		return nil, toConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.GetResonanceInfoResponse{
		Resonant:           info.Resonant,
		PartnerDisplayName: info.PartnerDisplayName,
		PartnerSlug:        info.PartnerSlug,
	}), nil
}

func toSummaryProtos(items []GiftSummary) []*cosimosiv1.GiftSummary {
	out := make([]*cosimosiv1.GiftSummary, 0, len(items))
	for _, g := range items {
		out = append(out, &cosimosiv1.GiftSummary{
			GiftId:                 g.GiftID,
			Token:                  g.Token,
			Status:                 statusToProto(g.Status),
			CounterpartDisplayName: g.CounterpartDisplayName,
			Message:                g.Message,
			CreatedAt:              formatTime(g.CreatedAt),
			RespondedAt:            formatTimePtr(g.RespondedAt),
			ExpiresAt:              formatTime(g.ExpiresAt),
		})
	}
	return out
}

// toConnectErr maps domain sentinels → Connect codes (spec 17). Unknown token is a UNIFORM
// NotFound (35); a terminal/expired state on a REAL token is FailedPrecondition (the holder
// learns the precise reason); self-respond + input bounds are InvalidArgument.
func toConnectErr(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return connect.NewError(connect.CodeNotFound, errors.New("not found"))
	case errors.Is(err, ErrStarNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, ErrSelfRespond),
		errors.Is(err, ErrEmptyText), errors.Is(err, ErrTextTooLong),
		errors.Is(err, ErrIntensityRange), errors.Is(err, ErrValenceRange),
		errors.Is(err, ErrMessageTooLong):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrNotPending), errors.Is(err, ErrExpired), errors.Is(err, ErrNotCancelable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}

// statusToProto maps a domain GiftStatus → the proto enum.
func statusToProto(s GiftStatus) cosimosiv1.GiftStatus {
	switch s {
	case StatusPending:
		return cosimosiv1.GiftStatus_GIFT_STATUS_PENDING
	case StatusAccepted:
		return cosimosiv1.GiftStatus_GIFT_STATUS_ACCEPTED
	case StatusDeclined:
		return cosimosiv1.GiftStatus_GIFT_STATUS_DECLINED
	case StatusCanceled:
		return cosimosiv1.GiftStatus_GIFT_STATUS_CANCELED
	case StatusExpired:
		return cosimosiv1.GiftStatus_GIFT_STATUS_EXPIRED
	default:
		return cosimosiv1.GiftStatus_GIFT_STATUS_UNSPECIFIED
	}
}

// formatTime renders an instant as RFC3339 UTC, or "" for the zero time.
func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

// formatTimePtr renders a nullable instant as RFC3339 UTC, or "" when nil.
func formatTimePtr(t *time.Time) string {
	if t == nil {
		return ""
	}
	return formatTime(*t)
}
