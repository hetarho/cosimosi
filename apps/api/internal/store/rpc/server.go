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

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}

func protoKind(kind store.OrnamentKind) storev1.OrnamentKind {
	switch kind {
	case store.KindBackground:
		return storev1.OrnamentKind_ORNAMENT_KIND_BACKGROUND
	case store.KindStarShader:
		return storev1.OrnamentKind_ORNAMENT_KIND_STAR_SHADER
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

// domainError maps the reads' canonical errors onto Connect codes. The two reads take no input, so
// there is no client-facing refusal beyond an unauthenticated scope.
func domainError(err error) error {
	if errors.Is(err, store.ErrScopeRequired) {
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	}
	return apperr.Internal(err)
}
