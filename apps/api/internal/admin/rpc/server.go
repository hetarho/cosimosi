package rpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/admin"
	"github.com/cosimosi/api/internal/ai"
	adminv1 "github.com/cosimosi/api/internal/gen/cosimosi/admin/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/secretbox"
)

var ErrServiceRequired = errors.New("admin rpc server requires the admin service")

type Server struct {
	service *admin.Service
}

func NewServer(service *admin.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) GetAdminSelf(ctx context.Context, _ *connect.Request[adminv1.GetAdminSelfRequest]) (*connect.Response[adminv1.GetAdminSelfResponse], error) {
	caller, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	isAdmin, err := s.service.GetAdminSelf(ctx, caller)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.GetAdminSelfResponse{IsAdmin: isAdmin}), nil
}

func (s *Server) ListAdmins(ctx context.Context, _ *connect.Request[adminv1.ListAdminsRequest]) (*connect.Response[adminv1.ListAdminsResponse], error) {
	entries, err := s.service.ListAdmins(ctx)
	if err != nil {
		return nil, domainError(err)
	}
	admins := make([]*adminv1.AdminEntry, 0, len(entries))
	for _, e := range entries {
		admins = append(admins, &adminv1.AdminEntry{
			UserId:    e.UserID,
			IsSeed:    e.IsSeed,
			GrantedBy: e.GrantedBy,
			GrantedAt: formatTime(e.GrantedAt),
		})
	}
	return connect.NewResponse(&adminv1.ListAdminsResponse{Admins: admins}), nil
}

func (s *Server) GrantAdmin(ctx context.Context, req *connect.Request[adminv1.GrantAdminRequest]) (*connect.Response[adminv1.GrantAdminResponse], error) {
	caller, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	isAdmin, err := s.service.GrantAdmin(ctx, caller, req.Msg.GetUserId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.GrantAdminResponse{IsAdmin: isAdmin}), nil
}

func (s *Server) RevokeAdmin(ctx context.Context, req *connect.Request[adminv1.RevokeAdminRequest]) (*connect.Response[adminv1.RevokeAdminResponse], error) {
	caller, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	isAdmin, err := s.service.RevokeAdmin(ctx, caller, req.Msg.GetUserId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.RevokeAdminResponse{IsAdmin: isAdmin}), nil
}

func (s *Server) ListUsers(ctx context.Context, req *connect.Request[adminv1.ListUsersRequest]) (*connect.Response[adminv1.ListUsersResponse], error) {
	page, err := s.service.ListUsers(ctx, int(req.Msg.GetPage()), int(req.Msg.GetPageSize()), req.Msg.GetQuery())
	if err != nil {
		return nil, domainError(err)
	}
	users := make([]*adminv1.AdminUser, 0, len(page.Users))
	for _, u := range page.Users {
		users = append(users, &adminv1.AdminUser{
			UserId:              u.UserID,
			Email:               u.Email,
			SignupAt:            formatTime(u.SignupAt),
			IsAdmin:             u.IsAdmin,
			IsSeedAdmin:         u.IsSeedAdmin,
			Basic:               int64(u.Balance.Basic),
			Additional:          int64(u.Balance.Additional),
			Total:               int64(u.Balance.Total),
			DiaryCount:          int64(u.DiaryCount),
			EpisodicMemoryCount: int64(u.EpisodicMemoryCount),
		})
	}
	return connect.NewResponse(&adminv1.ListUsersResponse{
		Users:   users,
		Page:    int32(page.Page),
		HasMore: page.HasMore,
	}), nil
}

func (s *Server) GrantStardust(ctx context.Context, req *connect.Request[adminv1.GrantStardustRequest]) (*connect.Response[adminv1.GrantStardustResponse], error) {
	caller, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	total, err := s.service.GrantStardust(ctx, caller, req.Msg.GetUserId(), int(req.Msg.GetAmount()), req.Msg.GetNote(), req.Msg.GetGrantId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.GrantStardustResponse{BalanceTotal: int64(total)}), nil
}

func (s *Server) ListTwinkleGrants(ctx context.Context, req *connect.Request[adminv1.ListTwinkleGrantsRequest]) (*connect.Response[adminv1.ListTwinkleGrantsResponse], error) {
	page, err := s.service.ListTwinkleGrants(ctx, int(req.Msg.GetPage()), int(req.Msg.GetPageSize()))
	if err != nil {
		return nil, domainError(err)
	}
	grants := make([]*adminv1.TwinkleGrant, 0, len(page.Grants))
	for _, g := range page.Grants {
		grants = append(grants, &adminv1.TwinkleGrant{
			Id:         g.ID,
			GrantedBy:  g.GrantedBy,
			TargetUser: g.TargetUser,
			Amount:     int64(g.Amount),
			Note:       g.Note,
			CreatedAt:  formatTime(g.CreatedAt),
		})
	}
	return connect.NewResponse(&adminv1.ListTwinkleGrantsResponse{
		Grants:  grants,
		Page:    int32(page.Page),
		HasMore: page.HasMore,
	}), nil
}

func (s *Server) GetAIConfig(ctx context.Context, _ *connect.Request[adminv1.GetAIConfigRequest]) (*connect.Response[adminv1.GetAIConfigResponse], error) {
	configs, err := s.service.GetAIConfig(ctx)
	if err != nil {
		return nil, domainError(err)
	}
	out := make([]*adminv1.AICapabilityConfig, 0, len(configs))
	for _, c := range configs {
		out = append(out, effectiveConfigToProto(c))
	}
	return connect.NewResponse(&adminv1.GetAIConfigResponse{Capabilities: out}), nil
}

func (s *Server) SetAIConfig(ctx context.Context, req *connect.Request[adminv1.SetAIConfigRequest]) (*connect.Response[adminv1.SetAIConfigResponse], error) {
	caller, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	capability, err := capabilityFromProto(req.Msg.GetCapability())
	if err != nil {
		return nil, domainError(err)
	}
	// The optional api_key: a nil field keeps the stored key; a present one replaces it.
	var apiKey *string
	if req.Msg.ApiKey != nil {
		key := req.Msg.GetApiKey()
		apiKey = &key
	}
	cfg, err := s.service.SetAIConfig(ctx, caller, capability, req.Msg.GetProvider(), req.Msg.GetModel(), req.Msg.GetBaseUrl(), apiKey)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.SetAIConfigResponse{Capability: effectiveConfigToProto(cfg)}), nil
}

func (s *Server) GetAIUsage(ctx context.Context, _ *connect.Request[adminv1.GetAIUsageRequest]) (*connect.Response[adminv1.GetAIUsageResponse], error) {
	usage, err := s.service.GetAIUsage(ctx)
	if err != nil {
		return nil, domainError(err)
	}
	caps := make([]*adminv1.AIUsageCapability, 0, len(usage.Capabilities))
	for _, c := range usage.Capabilities {
		caps = append(caps, &adminv1.AIUsageCapability{
			Capability: capabilityToProto(c.Capability),
			CallsToday: int64(c.CallsToday),
			DailyCap:   int64(c.DailyCap),
		})
	}
	return connect.NewResponse(&adminv1.GetAIUsageResponse{
		Capabilities:    caps,
		PerCallTokenCap: int64(usage.PerCallTokenCap),
		WindowUtcDay:    usage.WindowUTCDay,
		ProcessLocal:    usage.ProcessLocal,
	}), nil
}

func (s *Server) GetJobHealth(ctx context.Context, _ *connect.Request[adminv1.GetJobHealthRequest]) (*connect.Response[adminv1.GetJobHealthResponse], error) {
	health, err := s.service.GetJobHealth(ctx)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&adminv1.GetJobHealthResponse{
		Pending:      health.Pending,
		Running:      health.Running,
		Done:         health.Done,
		Failed:       health.Failed,
		DeadLettered: health.DeadLettered,
	}), nil
}

func callerID(ctx context.Context) (string, error) {
	userID, ok := platform.UserIDFromContext(ctx)
	if !ok || userID == "" {
		return "", connect.NewError(connect.CodeUnauthenticated, errors.New("unauthenticated"))
	}
	return userID, nil
}

func effectiveConfigToProto(c admin.EffectiveAIConfig) *adminv1.AICapabilityConfig {
	return &adminv1.AICapabilityConfig{
		Capability: capabilityToProto(c.Capability),
		Provider:   c.Provider,
		Model:      c.Model,
		BaseUrl:    c.BaseURL,
		KeySet:     c.KeySet,
		KeyHint:    c.KeyHint,
		Source:     c.Source,
		UpdatedBy:  c.UpdatedBy,
		UpdatedAt:  formatTime(c.UpdatedAt),
	}
}

func capabilityFromProto(c adminv1.AICapability) (admin.AICapability, error) {
	switch c {
	case adminv1.AICapability_AI_CAPABILITY_LLM:
		return admin.CapabilityLLM, nil
	case adminv1.AICapability_AI_CAPABILITY_EMBEDDING:
		return admin.CapabilityEmbedding, nil
	default:
		return "", admin.ErrUnknownCapability
	}
}

func capabilityToProto(c admin.AICapability) adminv1.AICapability {
	switch c {
	case admin.CapabilityLLM:
		return adminv1.AICapability_AI_CAPABILITY_LLM
	case admin.CapabilityEmbedding:
		return adminv1.AICapability_AI_CAPABILITY_EMBEDDING
	default:
		return adminv1.AICapability_AI_CAPABILITY_UNSPECIFIED
	}
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

// domainError maps the use-case's canonical errors onto Connect codes.
func domainError(err error) error {
	switch {
	case errors.Is(err, admin.ErrSeedAdminUndemotable):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	case errors.Is(err, admin.ErrUserIDRequired),
		errors.Is(err, admin.ErrGrantAmountRange),
		errors.Is(err, admin.ErrGrantIDRequired),
		errors.Is(err, admin.ErrUnknownCapability),
		errors.Is(err, admin.ErrProviderRequired),
		errors.Is(err, ai.ErrUnknownProvider),
		errors.Is(err, ai.ErrProviderNotImplemented):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, secretbox.ErrDisabled):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return err
	}
}
