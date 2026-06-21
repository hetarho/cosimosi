package settings

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// Handler adapts proto ↔ domain for the SettingsService RPCs. Thin: auth +
// proto/domain mapping + mood-enum validation; value policy lives in Service.
type Handler struct {
	cosimosiv1connect.UnimplementedSettingsServiceHandler
	svc *Service
}

// NewHandler builds the Connect handler over the settings service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

var _ cosimosiv1connect.SettingsServiceHandler = (*Handler)(nil)

// GetSettings returns the caller's stored visual overrides — the client merges its
// defaults over them, so the server does not send defaults.
func (h *Handler) GetSettings(ctx context.Context, _ *connect.Request[cosimosiv1.GetSettingsRequest]) (*connect.Response[cosimosiv1.GetSettingsResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	s, err := h.svc.Get(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.GetSettingsResponse{Settings: toProtoSettings(s)}), nil
}

// UpdateSettings upserts only the present fields and returns the merged result. Unknown
// mood/item or a malformed color → InvalidArgument; selecting a not-owned paid item →
// FailedPrecondition (ErrNotOwned). No partial write on any rejection.
func (h *Handler) UpdateSettings(ctx context.Context, req *connect.Request[cosimosiv1.UpdateSettingsRequest]) (*connect.Response[cosimosiv1.UpdateSettingsResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}

	msg := req.Msg
	p := Patch{Theme: msg.Theme, StarObject: msg.StarObject, SelfObject: msg.SelfObject, SynapseStyle: msg.SynapseStyle}
	for _, ec := range msg.GetEmotionColors() {
		mood, ok := moodKey(ec.GetMood())
		if !ok {
			return nil, connect.NewError(connect.CodeInvalidArgument, ErrInvalidMood)
		}
		p.EmotionColors = append(p.EmotionColors, EmotionColor{Mood: mood, Color: ec.GetColor()})
	}

	s, err := h.svc.Update(ctx, userID, p)
	switch {
	case errors.Is(err, ErrInvalidColor), errors.Is(err, ErrUnknownItem):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrNotOwned):
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.UpdateSettingsResponse{Settings: toProtoSettings(s)}), nil
}

// GetInventory returns the caller's 별가루 balance + owned paid items, seeding the wallet on first
// read (spec 44, A1). Auth required (A15).
func (h *Handler) GetInventory(ctx context.Context, _ *connect.Request[cosimosiv1.GetInventoryRequest]) (*connect.Response[cosimosiv1.GetInventoryResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	inv, err := h.svc.GetInventory(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.GetInventoryResponse{Stardust: int64(inv.Stardust), OwnedItemIds: inv.OwnedItemIDs}), nil
}

// PurchaseItem buys a paid item: debit + grant atomically (spec 44, A2). Unknown/free item →
// InvalidArgument; already owned / insufficient funds → FailedPrecondition. Auth required (A15).
func (h *Handler) PurchaseItem(ctx context.Context, req *connect.Request[cosimosiv1.PurchaseItemRequest]) (*connect.Response[cosimosiv1.PurchaseItemResponse], error) {
	userID, err := rpcserver.RequireUserID(ctx)
	if err != nil {
		return nil, err
	}
	inv, err := h.svc.PurchaseItem(ctx, userID, req.Msg.GetItemId())
	switch {
	case errors.Is(err, ErrUnknownItem), errors.Is(err, ErrItemFree):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrAlreadyOwned), errors.Is(err, ErrInsufficientFunds):
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.PurchaseItemResponse{Stardust: int64(inv.Stardust), OwnedItemIds: inv.OwnedItemIDs}), nil
}

// toProtoSettings maps domain → proto, converting lowercase mood names back to the
// enum. An unknown stored mood is skipped (defensive — writes are validated).
func toProtoSettings(s Settings) *cosimosiv1.Settings {
	out := &cosimosiv1.Settings{
		Theme:        s.Theme,
		StarObject:   s.StarObject,
		SelfObject:   s.SelfObject,
		SynapseStyle: s.SynapseStyle,
	}
	for _, c := range s.EmotionColors {
		num, ok := cosimosiv1.Mood_value[strings.ToUpper(c.Mood)]
		if !ok {
			continue
		}
		out.EmotionColors = append(out.EmotionColors, &cosimosiv1.EmotionColor{
			Mood:  cosimosiv1.Mood(num),
			Color: c.Color,
		})
	}
	return out
}

// moodKey converts a proto Mood enum to its lowercase storage key, rejecting
// UNSPECIFIED and out-of-range values (only the 13 named moods are valid — spec 29).
func moodKey(m cosimosiv1.Mood) (string, bool) {
	if m == cosimosiv1.Mood_MOOD_UNSPECIFIED {
		return "", false
	}
	name, ok := cosimosiv1.Mood_name[int32(m)]
	if !ok {
		return "", false
	}
	return strings.ToLower(name), true
}
