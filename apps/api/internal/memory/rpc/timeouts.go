package rpc

import (
	"time"

	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/platform"
)

const (
	// providerTimeout covers a procedure that waits on an LLM or embedding provider call.
	providerTimeout = 3 * time.Minute
	// exportTimeout covers serializing a whole universe.
	exportTimeout = 2 * time.Minute
)

// ProcedureTimeouts are memory's request deadlines beyond the platform default. The root registers
// them with this service, so a new provider-backed procedure is added here, next to its handler.
func ProcedureTimeouts() []platform.ProcedureTimeout {
	return []platform.ProcedureTimeout{
		{Procedure: memoryv1connect.MemoryServiceSplitDiaryProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceReviseSplitProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceLaunchStarsProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceRecallProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceRecallDiaryStarsProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceSuggestLetGoProcedure, Timeout: providerTimeout},
		{Procedure: memoryv1connect.MemoryServiceExportProcedure, Timeout: exportTimeout},
	}
}
