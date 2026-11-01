package rpc

import (
	"connectrpc.com/connect"
	"context"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"time"
)

// PaidUseCases is the transport's paid-action capability, independent of encoding and archive reads.
type PaidUseCases interface {
	Recall(context.Context, platform.UserScope, string, string, string, bool) (memory.RecallResult, error)
	RecallDiaryStars(context.Context, platform.UserScope, string, string, bool) (memory.RecallDiaryStarsResult, error)
	ViewSemantic(context.Context, platform.UserScope, string, string) (memory.ViewSemanticResult, error)
}
type PaidServer struct {
	memoryv1connect.UnimplementedMemoryServiceHandler
	paid PaidUseCases
}

func NewPaidServer(paid PaidUseCases) (*PaidServer, error) {
	if paid == nil {
		return nil, ErrServiceRequired
	}
	return &PaidServer{paid: paid}, nil
}

func (s *PaidServer) Recall(ctx context.Context, req *connect.Request[memoryv1.RecallRequest]) (*connect.Response[memoryv1.RecallResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.paid.Recall(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetMemoryId(), req.Msg.GetRewriteText(), req.Msg.GetSyncConsent())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.RecallResponse{
		Reconsolidated:       result.Reconsolidated,
		CurrentText:          result.CurrentText,
		Seed:                 result.Seed,
		RecallCount:          result.RecallCount,
		EffectiveStrength:    float32(result.EffectiveStrength),
		PreviousUniverseTime: dateValue(result.Sync.Previous),
		UniverseTime:         result.Sync.Current.Format(time.DateOnly),
	}), nil
}

func (s *PaidServer) RecallDiaryStars(ctx context.Context, req *connect.Request[memoryv1.RecallDiaryStarsRequest]) (*connect.Response[memoryv1.RecallDiaryStarsResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.paid.RecallDiaryStars(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetDiaryId(), req.Msg.GetSyncConsent())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.RecallDiaryStarsResponse{
		DiaryId:              result.DiaryID,
		EpisodicMemoryIds:    result.EpisodicMemoryIDs,
		PreviousUniverseTime: dateValue(result.Sync.Previous),
		UniverseTime:         result.Sync.Current.Format(time.DateOnly),
	}), nil
}

func (s *PaidServer) ViewSemantic(ctx context.Context, req *connect.Request[memoryv1.ViewSemanticRequest]) (*connect.Response[memoryv1.ViewSemanticResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	result, err := s.paid.ViewSemantic(ctx, scope, req.Msg.GetOperationId(), req.Msg.GetEpisodicMemoryId())
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.ViewSemanticResponse{
		Text:         result.Text,
		ReachedStage: int32(result.ReachedStage),
	}), nil
}
