// Package rpc is the store context's transport adapter: thin Connect handlers that map domain rows
// to proto DTOs and call the reads (ARCHITECTURE §2.7/§2.9#7). No policy lives here — pricing,
// ownership and default resolution all belong to the context behavior.
package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	storev1 "github.com/cosimosi/api/internal/gen/cosimosi/store/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	"github.com/cosimosi/api/internal/store"
)

var ErrServiceRequired = errors.New("store rpc server requires the store service")

type Server struct {
	service *store.Service
}

func NewServer(service *store.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) GetCatalog(
	ctx context.Context,
	_ *connect.Request[storev1.GetCatalogRequest],
) (*connect.Response[storev1.GetCatalogResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	items, err := s.service.Catalog(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	ornaments := make([]*storev1.Ornament, 0, len(items))
	for _, item := range items {
		ornaments = append(ornaments, &storev1.Ornament{
			OrnamentId:  string(item.ID),
			Kind:        protoKind(item.Kind),
			Acquisition: protoAcquisition(item.Acquisition),
			Price:       int64(item.Price),
			Owned:       item.Owned,
			Selected:    item.Selected,
		})
	}
	return connect.NewResponse(&storev1.GetCatalogResponse{Ornaments: ornaments}), nil
}

func (s *Server) GetSelection(
	ctx context.Context,
	_ *connect.Request[storev1.GetSelectionRequest],
) (*connect.Response[storev1.GetSelectionResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	applied, err := s.service.Selection(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	selections := make([]*storev1.OrnamentSelection, 0, len(applied))
	for _, entry := range applied {
		selections = append(selections, &storev1.OrnamentSelection{
			Kind:       protoKind(entry.Kind),
			OrnamentId: string(entry.OrnamentID),
		})
	}
	return connect.NewResponse(&storev1.GetSelectionResponse{Selections: selections}), nil
}

// Decorate is the one mutation on this service. Thin: map the named id fields onto the domain
// selection, call the use-case, and translate its refusal — the atomicity, the pricing and the
// item-blaming all belong to the use-case (§2.9 #7).
func (s *Server) Decorate(
	ctx context.Context,
	req *connect.Request[storev1.DecorateRequest],
) (*connect.Response[storev1.DecorateResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	requested := store.Selection{
		store.KindBackground: store.OrnamentID(req.Msg.GetBackgroundOrnamentId()),
		store.KindStarShader: store.OrnamentID(req.Msg.GetStarShaderOrnamentId()),
		store.KindGistShader: store.OrnamentID(req.Msg.GetGistShaderOrnamentId()),
		store.KindMote:       store.OrnamentID(req.Msg.GetMoteOrnamentId()),
		store.KindMoteField:  store.OrnamentID(req.Msg.GetMoteFieldOrnamentId()),
	}
	applied, spent, err := s.service.Decorate(ctx, scope, requested)
	if err != nil {
		return nil, domainError(err)
	}
	selection := make([]*storev1.OrnamentSelection, 0, len(applied))
	for _, entry := range applied {
		selection = append(selection, &storev1.OrnamentSelection{
			Kind:       protoKind(entry.Kind),
			OrnamentId: string(entry.OrnamentID),
		})
	}
	return connect.NewResponse(&storev1.DecorateResponse{
		Selection:    selection,
		SpentTwinkle: int64(spent),
	}), nil
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}

// protoKind maps the domain's closed kind set onto the wire enum. Every declared kind must appear
// here: an unmapped one leaves as UNSPECIFIED, which proto3 JSON omits entirely and every client
// drops rather than guesses — so the rows of a whole kind would vanish from the panel with no error
// anywhere. `server_test.go` walks `store.AllOrnamentKinds()` against this, because the `default`
// arm below cannot tell a missing case from a genuinely unknown value.
func protoKind(kind store.OrnamentKind) storev1.OrnamentKind {
	switch kind {
	case store.KindBackground:
		return storev1.OrnamentKind_ORNAMENT_KIND_BACKGROUND
	case store.KindStarShader:
		return storev1.OrnamentKind_ORNAMENT_KIND_STAR_SHADER
	case store.KindGistShader:
		return storev1.OrnamentKind_ORNAMENT_KIND_GIST_SHADER
	case store.KindMote:
		return storev1.OrnamentKind_ORNAMENT_KIND_MOTE
	case store.KindMoteField:
		return storev1.OrnamentKind_ORNAMENT_KIND_MOTE_FIELD
	default:
		return storev1.OrnamentKind_ORNAMENT_KIND_UNSPECIFIED
	}
}

func protoAcquisition(acquisition store.OrnamentAcquisition) storev1.OrnamentAcquisition {
	switch acquisition {
	case store.AcquisitionFree:
		return storev1.OrnamentAcquisition_ORNAMENT_ACQUISITION_FREE
	case store.AcquisitionPurchase:
		return storev1.OrnamentAcquisition_ORNAMENT_ACQUISITION_PURCHASE
	case store.AcquisitionAchievement:
		return storev1.OrnamentAcquisition_ORNAMENT_ACQUISITION_ACHIEVEMENT
	default:
		return storev1.OrnamentAcquisition_ORNAMENT_ACQUISITION_UNSPECIFIED
	}
}

// domainError maps the context's canonical errors onto Connect codes. The refusal metadata is the
// domain's own Detail() — the shortfall is forwarded, never recomputed here.
func domainError(err error) error {
	switch {
	case errors.Is(err, store.ErrScopeRequired):
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	case errors.Is(err, store.ErrUnknownOrnamentID):
		return apperr.Domain(connect.CodeInvalidArgument, reasonOrnamentUnknown, err, nil)
	case errors.Is(err, store.ErrOrnamentNotPurchasable):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonOrnamentNotPurchasable, err, nil)
	case errors.Is(err, store.ErrInsufficientTwinkle):
		var insufficient *store.InsufficientTwinkle
		if errors.As(err, &insufficient) {
			return apperr.Domain(connect.CodeResourceExhausted, reasonInsufficientTwinkle, err, insufficient.Detail())
		}
		return apperr.Domain(connect.CodeResourceExhausted, reasonInsufficientTwinkle, err, nil)
	default:
		return apperr.Internal(err)
	}
}
