package admin

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"

	cosimosiv1 "github.com/cosimosi/backend/internal/gen/cosimosi/v1"
	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
)

// Handler adapts proto ↔ domain for the AdminService RPCs. Thin: mapping +
// error-code translation only; policy lives in Service. Authorization happens
// before this layer — the admin-gate interceptor (rpcserver) has already
// rejected non-allowlisted callers, so handlers don't re-check identity.
//
// Plaintext keys travel exactly one way through here: request → service.
// No response constructor below ever touches an api_key field.
type Handler struct {
	cosimosiv1connect.UnimplementedAdminServiceHandler
	svc *Service
}

// NewHandler builds the Connect handler over the admin service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

var _ cosimosiv1connect.AdminServiceHandler = (*Handler)(nil)

func (h *Handler) GetLLMConfig(ctx context.Context, _ *connect.Request[cosimosiv1.GetLLMConfigRequest]) (*connect.Response[cosimosiv1.GetLLMConfigResponse], error) {
	cfg, err := h.svc.GetConfig(ctx)
	if err != nil {
		return nil, asConnectErr(err)
	}
	res := &cosimosiv1.GetLLMConfigResponse{
		ActiveProvider:  cfg.Active.Provider,
		ActiveModel:     cfg.Active.Model,
		EncryptionReady: cfg.EncryptionReady,
	}
	for _, p := range cfg.Providers {
		res.Providers = append(res.Providers, toProtoProvider(p))
	}
	return connect.NewResponse(res), nil
}

func (h *Handler) SetProviderKey(ctx context.Context, req *connect.Request[cosimosiv1.SetProviderKeyRequest]) (*connect.Response[cosimosiv1.SetProviderKeyResponse], error) {
	card, err := h.svc.SetKey(ctx, req.Msg.GetProvider(), req.Msg.GetApiKey())
	if err != nil {
		return nil, asConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.SetProviderKeyResponse{Provider: toProtoProvider(card)}), nil
}

func (h *Handler) DeleteProviderKey(ctx context.Context, req *connect.Request[cosimosiv1.DeleteProviderKeyRequest]) (*connect.Response[cosimosiv1.DeleteProviderKeyResponse], error) {
	card, err := h.svc.DeleteKey(ctx, req.Msg.GetProvider())
	if err != nil {
		return nil, asConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.DeleteProviderKeyResponse{Provider: toProtoProvider(card)}), nil
}

func (h *Handler) UpdateProviderModels(ctx context.Context, req *connect.Request[cosimosiv1.UpdateProviderModelsRequest]) (*connect.Response[cosimosiv1.UpdateProviderModelsResponse], error) {
	card, err := h.svc.UpdateModels(ctx, req.Msg.GetProvider(), req.Msg.GetModels())
	if err != nil {
		return nil, asConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.UpdateProviderModelsResponse{Provider: toProtoProvider(card)}), nil
}

func (h *Handler) SetActiveLLM(ctx context.Context, req *connect.Request[cosimosiv1.SetActiveLLMRequest]) (*connect.Response[cosimosiv1.SetActiveLLMResponse], error) {
	sel, err := h.svc.SetActive(ctx, req.Msg.GetProvider(), req.Msg.GetModel())
	if err != nil {
		return nil, asConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.SetActiveLLMResponse{
		ActiveProvider: sel.Provider,
		ActiveModel:    sel.Model,
	}), nil
}

func (h *Handler) TestProviderKey(ctx context.Context, req *connect.Request[cosimosiv1.TestProviderKeyRequest]) (*connect.Response[cosimosiv1.TestProviderKeyResponse], error) {
	result, err := h.svc.TestKey(ctx, req.Msg.GetProvider(), req.Msg.GetModel(), req.Msg.GetApiKey())
	if err != nil {
		return nil, asConnectErr(err)
	}
	return connect.NewResponse(&cosimosiv1.TestProviderKeyResponse{
		Ok:        result.OK,
		Message:   result.Message,
		LatencyMs: result.Latency.Milliseconds(),
	}), nil
}

func (h *Handler) GetAdminOverview(ctx context.Context, _ *connect.Request[cosimosiv1.GetAdminOverviewRequest]) (*connect.Response[cosimosiv1.GetAdminOverviewResponse], error) {
	ov, err := h.svc.Overview(ctx)
	if err != nil {
		return nil, asConnectErr(err)
	}
	res := &cosimosiv1.GetAdminOverviewResponse{
		Users:          ov.Users,
		Records:        ov.Records,
		Memories:       ov.Memories,
		Synapses:       ov.Synapses,
		JobsPending:    ov.JobsPending,
		JobsProcessing: ov.JobsProcessing,
		JobsFailed:     ov.JobsFailed,
		JobsDone_24H:   ov.JobsDone24h,
	}
	for _, dc := range ov.RecordSeries {
		res.RecordSeries = append(res.RecordSeries, &cosimosiv1.DayCount{
			Day:   dc.Day.Format(time.DateOnly),
			Count: dc.Count,
		})
	}
	for _, u := range ov.Usage {
		res.LlmUsage = append(res.LlmUsage, &cosimosiv1.UsageRow{
			Day:          u.Day.Format(time.DateOnly),
			Provider:     u.Provider,
			Model:        u.Model,
			Kind:         u.Kind,
			Calls:        u.Calls,
			InputTokens:  u.InputTokens,
			OutputTokens: u.OutputTokens,
		})
	}
	return connect.NewResponse(res), nil
}

// toProtoProvider maps a merged card — key state only, never key material.
func toProtoProvider(p ProviderConfig) *cosimosiv1.ProviderConfig {
	out := &cosimosiv1.ProviderConfig{
		Provider:     p.Provider,
		DefaultModel: p.DefaultModel,
		Models:       p.Models,
		KeySet:       p.KeySet,
		KeyLast4:     p.KeyLast4,
	}
	if !p.KeyUpdatedAt.IsZero() {
		out.KeyUpdatedAt = p.KeyUpdatedAt.UTC().Format(time.RFC3339)
	}
	return out
}

// asConnectErr maps domain sentinels to Connect codes (the spec-17 pattern):
// bad input → InvalidArgument, missing master key → FailedPrecondition
// (server setup, not caller error), everything else → Internal.
func asConnectErr(err error) *connect.Error {
	switch {
	case errors.Is(err, ErrUnknownProvider), errors.Is(err, ErrInvalidModel),
		errors.Is(err, ErrEmptyKey), errors.Is(err, ErrKeyTooShort), errors.Is(err, ErrNoStoredKey):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, ErrEncryptionKeyMissing):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
