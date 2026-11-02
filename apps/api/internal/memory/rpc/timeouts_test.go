package rpc

import (
	"net/http"
	"testing"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/platform"
)

// Platform refuses a duplicate or out-of-range deadline at composition; memory's list must pass.
func TestProcedureTimeoutsAreAcceptedByThePlatform(t *testing.T) {
	t.Parallel()
	defer func() {
		if recovered := recover(); recovered != nil {
			t.Fatalf("platform refused memory's procedure timeouts: %v", recovered)
		}
	}()
	platform.NewHandler(nil, platform.WithRPCService(
		func(...connect.HandlerOption) (string, http.Handler) {
			return "/unused.v1.Unused/", http.NotFoundHandler()
		},
		ProcedureTimeouts()...,
	))
}
