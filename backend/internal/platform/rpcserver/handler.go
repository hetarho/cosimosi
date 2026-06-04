package rpcserver

import "github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"

// memoryServiceStub is a temporary MemoryService implementation: every RPC
// returns CodeUnimplemented, inherited from the generated embed. It exists only
// so the server compiles and boots for spec 02 (RPC contract + plumbing).
//
// Spec 04 implements the real service in internal/memory (handler.go) and
// rewires cmd/api to mount memory.NewHandler instead — removing this stub.
type memoryServiceStub struct {
	cosimosiv1connect.UnimplementedMemoryServiceHandler
}
