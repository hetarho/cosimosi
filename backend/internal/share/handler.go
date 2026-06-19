package share

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

// Handler adapts proto ↔ domain for BOTH share services. It implements:
//   - ShareServiceHandler (authenticated owner settings) — user_id from the JWT (the auth
//     interceptor runs before this; every query is scoped to the caller, acceptance 3.2).
//   - VisitServiceHandler (UNAUTHENTICATED public read) — GetSharedUniverse takes only a slug;
//     there is intentionally NO UserIDFromContext call (the visit chain has no auth interceptor).
//
// One struct serves both because they share the Service; the auth boundary is enforced by the
// interceptor chain each service is MOUNTED with (rpcserver), not here. Thin: mapping + error
// translation only; policy lives in Service.
type Handler struct {
	cosimosiv1connect.UnimplementedShareServiceHandler
	cosimosiv1connect.UnimplementedVisitServiceHandler
	svc *Service
}

// NewHandler builds the Connect handler over the share service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

var (
	_ cosimosiv1connect.ShareServiceHandler = (*Handler)(nil)
	_ cosimosiv1connect.VisitServiceHandler = (*Handler)(nil)
)

// --- ShareService (authenticated owner) ---

func (h *Handler) GetShareSettings(ctx context.Context, _ *connect.Request[cosimosiv1.GetShareSettingsRequest]) (*connect.Response[cosimosiv1.GetShareSettingsResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	st, err := h.svc.GetSettings(ctx, userID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.GetShareSettingsResponse{
		Enabled:     st.Enabled,
		Slug:        st.Slug,
		DisplayName: st.DisplayName,
	}), nil
}

func (h *Handler) UpdateShareSettings(ctx context.Context, req *connect.Request[cosimosiv1.UpdateShareSettingsRequest]) (*connect.Response[cosimosiv1.UpdateShareSettingsResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	st, err := h.svc.UpdateSettings(ctx, userID, req.Msg.GetEnabled(), req.Msg.GetDisplayName())
	switch {
	case errors.Is(err, ErrDisplayNameTooLong):
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.UpdateShareSettingsResponse{
		Enabled:     st.Enabled,
		Slug:        st.Slug,
		DisplayName: st.DisplayName,
	}), nil
}

func (h *Handler) RotateShareSlug(ctx context.Context, _ *connect.Request[cosimosiv1.RotateShareSlugRequest]) (*connect.Response[cosimosiv1.RotateShareSlugResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	st, err := h.svc.RotateSlug(ctx, userID)
	switch {
	case errors.Is(err, ErrNotShared):
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&cosimosiv1.RotateShareSlugResponse{
		Enabled:     st.Enabled,
		Slug:        st.Slug,
		DisplayName: st.DisplayName,
	}), nil
}

func (h *Handler) GetResonanceBridges(ctx context.Context, req *connect.Request[cosimosiv1.GetResonanceBridgesRequest]) (*connect.Response[cosimosiv1.GetResonanceBridgesResponse], error) {
	userID, ok := rpcserver.UserIDFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("missing authenticated user"))
	}
	bridges, err := h.svc.ResonanceBridges(ctx, userID, req.Msg.GetSlug())
	switch {
	case errors.Is(err, ErrNotFound):
		return nil, connect.NewError(connect.CodeNotFound, errors.New("not found")) // uniform — owner stopped sharing (3.2)
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	out := make([]*cosimosiv1.ResonanceBridge, len(bridges))
	for i, b := range bridges {
		out[i] = &cosimosiv1.ResonanceBridge{MyMemoryId: b.MyMemoryID, TheirStarIndex: int32(b.TheirStarIndex)}
	}
	return connect.NewResponse(&cosimosiv1.GetResonanceBridgesResponse{Bridges: out}), nil
}

// --- VisitService (UNAUTHENTICATED public read) ---

// GetSharedUniverse returns the public landscape for a slug. NO auth — the slug IS the
// capability. An unknown/disabled slug → uniform NotFound (acceptance 1.2/3.1); the response
// carries no diary/fragment text, no ids, no precise timestamps (content-zero by type, 1.1).
func (h *Handler) GetSharedUniverse(ctx context.Context, req *connect.Request[cosimosiv1.GetSharedUniverseRequest]) (*connect.Response[cosimosiv1.GetSharedUniverseResponse], error) {
	snap, err := h.svc.Snapshot(ctx, req.Msg.GetSlug())
	switch {
	case errors.Is(err, ErrNotFound):
		return nil, connect.NewError(connect.CodeNotFound, errors.New("not found"))
	case err != nil:
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	stars := make([]*cosimosiv1.SharedStar, len(snap.Stars))
	for i, s := range snap.Stars {
		stars[i] = &cosimosiv1.SharedStar{
			Mood:            moodToProto(s.Mood),
			Intensity:       s.Intensity,
			LastRecalledDay: s.LastRecalledDay,
			CreatedDay:      s.CreatedDay,
		}
	}
	synapses := make([]*cosimosiv1.SharedSynapse, len(snap.Synapses))
	for i, s := range snap.Synapses {
		synapses[i] = &cosimosiv1.SharedSynapse{A: int32(s.A), B: int32(s.B), Weight: s.Weight}
	}
	return connect.NewResponse(&cosimosiv1.GetSharedUniverseResponse{
		DisplayName: snap.DisplayName,
		Stars:       stars,
		Synapses:    synapses,
		Appearance:  toProtoSettings(snap.Appearance),
		// spec 07: no ambient field — the visitor derives the 요즘 emotion ranking from these
		// SharedStars themselves (the same client weave path as the owner), so this context
		// stays decoupled from any server-side emotion aggregation.
	}), nil
}

// toProtoSettings maps the owner's visual overrides → proto Settings, converting lowercase mood
// names back to the Mood enum (mirrors settings.toProtoSettings).
func toProtoSettings(a Appearance) *cosimosiv1.Settings {
	colors := make([]*cosimosiv1.EmotionColor, 0, len(a.EmotionColors))
	for _, c := range a.EmotionColors {
		colors = append(colors, &cosimosiv1.EmotionColor{Mood: moodToProto(c.Mood), Color: c.Color})
	}
	return &cosimosiv1.Settings{
		Theme:         a.Theme,
		StarObject:    a.StarObject,
		SelfObject:    a.SelfObject,
		SynapseStyle:  a.SynapseStyle,
		EmotionColors: colors,
	}
}

// moodToProto maps a lowercase domain mood name → the Mood enum; unknown/"" → MOOD_UNSPECIFIED.
func moodToProto(mood string) cosimosiv1.Mood {
	if num, ok := cosimosiv1.Mood_value[strings.ToUpper(mood)]; ok {
		return cosimosiv1.Mood(num)
	}
	return cosimosiv1.Mood_MOOD_UNSPECIFIED
}
