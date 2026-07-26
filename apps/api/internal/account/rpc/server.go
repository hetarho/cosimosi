// Package rpc is the account context's transport adapter: a thin Connect handler mapping proto
// DTOs to domain calls (ARCHITECTURE §2.7/§2.9#7). No policy lives here — id validation, the
// unset/unknown default, and per-user scoping all live in the use-case and the auth interceptor.
package rpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountv1 "github.com/cosimosi/api/internal/gen/cosimosi/account/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
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

func (s *Server) SignUp(ctx context.Context, req *connect.Request[accountv1.SignUpRequest]) (*connect.Response[accountv1.SignUpResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	profile, inviteBound, err := s.service.SignUp(ctx, scope, account.SignUpInput{
		Nickname:    req.Msg.GetNickname(),
		Timezone:    req.Msg.GetTimezone(),
		Locale:      req.Msg.GetLocale(),
		InviteToken: req.Msg.GetInviteToken(),
	})
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.SignUpResponse{
		Nickname:    profile.Nickname,
		Timezone:    profile.Timezone,
		Locale:      profile.Locale,
		InviteBound: inviteBound,
	}), nil
}

func (s *Server) GetProfile(ctx context.Context, _ *connect.Request[accountv1.GetProfileRequest]) (*connect.Response[accountv1.GetProfileResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	profile, err := s.service.GetProfile(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	response := &accountv1.GetProfileResponse{}
	if profile != nil {
		response.Profile = profileMessage(*profile)
	}
	return connect.NewResponse(response), nil
}

func (s *Server) UpdateProfile(ctx context.Context, req *connect.Request[accountv1.UpdateProfileRequest]) (*connect.Response[accountv1.UpdateProfileResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	profile, err := s.service.UpdateProfile(ctx, scope, account.UpdateProfileInput{
		Nickname: req.Msg.GetNickname(),
		Timezone: req.Msg.GetTimezone(),
		Locale:   req.Msg.GetLocale(),
	})
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.UpdateProfileResponse{Profile: profileMessage(profile)}), nil
}

func (s *Server) ListAuthProviders(ctx context.Context, _ *connect.Request[accountv1.ListAuthProvidersRequest]) (*connect.Response[accountv1.ListAuthProvidersResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	providers, err := s.service.ListAuthProviders(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	response := &accountv1.ListAuthProvidersResponse{
		Providers: make([]*accountv1.LinkedAuthProvider, 0, len(providers)),
	}
	for _, provider := range providers {
		response.Providers = append(response.Providers, &accountv1.LinkedAuthProvider{
			Kind:     providerKindMessage(provider.Kind),
			LinkedAt: formatTime(provider.LinkedAt),
		})
	}
	return connect.NewResponse(response), nil
}

func (s *Server) GetInviteLink(ctx context.Context, _ *connect.Request[accountv1.GetInviteLinkRequest]) (*connect.Response[accountv1.GetInviteLinkResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	link, err := s.service.GetInviteLink(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.GetInviteLinkResponse{
		Token:     link.Token,
		ExpiresAt: link.ExpiresAt.Format(time.RFC3339),
	}), nil
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

func (s *Server) Withdraw(
	ctx context.Context,
	_ *connect.Request[accountv1.WithdrawRequest],
) (*connect.Response[accountv1.WithdrawResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	window, err := s.service.Withdraw(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.WithdrawResponse{
		WithdrawnAt:       formatTime(window.WithdrawnAt),
		RestoreDeadlineAt: formatTime(window.RestoreDeadlineAt),
	}), nil
}

func (s *Server) RestoreAccount(
	ctx context.Context,
	_ *connect.Request[accountv1.RestoreAccountRequest],
) (*connect.Response[accountv1.RestoreAccountResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	restoredAt, err := s.service.RestoreAccount(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&accountv1.RestoreAccountResponse{
		RestoredAt: formatTime(restoredAt),
	}), nil
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, account.ErrSignupRequired):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonSignupRequired, err, nil)
	case errors.Is(err, account.ErrNotProvisioned):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonNotProvisioned, err, nil)
	case errors.Is(err, account.ErrNicknameInvalid):
		return apperr.Domain(connect.CodeInvalidArgument, reasonNicknameInvalid, err, nil)
	case errors.Is(err, account.ErrTimezoneInvalid):
		return apperr.Domain(connect.CodeInvalidArgument, reasonTimezoneInvalid, err, nil)
	case errors.Is(err, account.ErrLocaleInvalid):
		return apperr.Domain(connect.CodeInvalidArgument, reasonLocaleInvalid, err, nil)
	case errors.Is(err, account.ErrInviteLinkUnavailable):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonInviteLinkUnavailable, err, nil)
	case errors.Is(err, account.ErrNotWithdrawn):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonNotWithdrawn, err, nil)
	case errors.Is(err, account.ErrRestoreWindowExpired):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonRestoreWindowExpired, err, nil)
	case errors.Is(err, account.ErrUnknownPaletteID):
		return apperr.Domain(connect.CodeInvalidArgument, reasonUnknownPalette, err, nil)
	case errors.Is(err, account.ErrScopeRequired):
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	default:
		return apperr.Internal(err)
	}
}

func profileMessage(view account.ProfileView) *accountv1.Profile {
	return &accountv1.Profile{
		Nickname:  view.Profile.Nickname,
		Timezone:  view.Profile.Timezone,
		Locale:    view.Profile.Locale,
		Email:     view.Email,
		CreatedAt: formatTime(view.Profile.CreatedAt),
	}
}

func providerKindMessage(kind account.AuthProviderKind) accountv1.AuthProviderKind {
	switch kind {
	case account.AuthProviderGoogle:
		return accountv1.AuthProviderKind_AUTH_PROVIDER_KIND_GOOGLE
	case account.AuthProviderPassword:
		return accountv1.AuthProviderKind_AUTH_PROVIDER_KIND_PASSWORD
	default:
		return accountv1.AuthProviderKind_AUTH_PROVIDER_KIND_UNSPECIFIED
	}
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}
