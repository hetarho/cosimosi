package platform

import (
	"context"
	"time"

	"connectrpc.com/connect"
	platformv1 "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type PlatformService struct {
	now func() time.Time
}

func NewPlatformService(now func() time.Time) PlatformService {
	return PlatformService{now: now}
}

func (s PlatformService) Ping(
	ctx context.Context,
	_ *connect.Request[platformv1.PingRequest],
) (*connect.Response[platformv1.PingResponse], error) {
	now := time.Now
	if s.now != nil {
		now = s.now
	}
	return connect.NewResponse(&platformv1.PingResponse{
		Message:    "pong",
		ServerTime: timestamppb.New(now().UTC()),
		RequestId:  RequestIDFromContext(ctx),
	}), nil
}
