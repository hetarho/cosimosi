// Package rpc is the account context's transport adapter: a thin Connect handler mapping proto
// DTOs to domain calls (ARCHITECTURE §2.7/§2.9#7). No policy lives here — id validation, the
// unset/unknown default, and per-user scoping all live in the use-case and the auth interceptor.
package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountv1 "github.com/cosimosi/api/internal/gen/cosimosi/account/v1"
	"github.com/cosimosi/api/internal/platform"
)

var ErrServiceRequired = errors.New("account rpc server requires the account service")

type Server struct {
	service *account.Service
}

func NewServer(service *account.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) GetPalettePreference(ctx context.Context, _ *connect.Request[accountv1.GetPalettePreferenceRequest]) (*connect.Response[accountv1.PalettePreference], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	paletteID, err := s.service.GetPalettePreference(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.PalettePreference{PaletteId: paletteID}), nil
}

func (s *Server) SetPalettePreference(ctx context.Context, req *connect.Request[accountv1.SetPalettePreferenceRequest]) (*connect.Response[accountv1.PalettePreference], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	paletteID, err := s.service.SetPalettePreference(ctx, scope, req.Msg.GetPaletteId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.PalettePreference{PaletteId: paletteID}), nil
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, connect.NewError(connect.CodeUnauthenticated, err)
	}
	return scope, nil
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, account.ErrUnknownPaletteID):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, account.ErrScopeRequired):
		return connect.NewError(connect.CodeUnauthenticated, err)
	default:
		return err
	}
}
