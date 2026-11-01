package rpc

import (
	"connectrpc.com/connect"
	"context"
	"errors"
	memoryv1 "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// The transport consumes only the export behavior, not the memory command facade.
type ExportUseCase interface {
	Export(context.Context, platform.UserScope, memory.ExportFormat) (memory.ExportResult, error)
}

type ExportServer struct {
	memoryv1connect.UnimplementedMemoryServiceHandler
	exporter ExportUseCase
}

func NewExportServer(exporter ExportUseCase) (*ExportServer, error) {
	if exporter == nil {
		return nil, errors.New("export RPC requires an export use case")
	}
	return &ExportServer{exporter: exporter}, nil
}

func (s *ExportServer) Export(ctx context.Context, req *connect.Request[memoryv1.ExportRequest]) (*connect.Response[memoryv1.ExportResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	format, err := domainExportFormat(req.Msg.GetFormat())
	if err != nil {
		return nil, err
	}
	result, err := s.exporter.Export(ctx, scope, format)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&memoryv1.ExportResponse{
		Content:     result.Content,
		ContentType: result.ContentType,
		Filename:    result.Filename,
	}), nil
}
