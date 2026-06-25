package ai

import (
	"testing"

	"github.com/cosimosi/backend/internal/memory"
)

// Alignment guard for the two body caps (17): memory.MaxBodyRunes (validation)
// must never exceed maxInputRunes (embedder truncation) — a validated body that
// gets truncated before embedding gives the star a semantic position that
// ignores the diary's tail. Test-only dependency: production ai never imports
// memory (and memory imports neither ai nor job, so no cycle).
func TestEmbedderCapCoversValidatedBodies(t *testing.T) {
	if maxInputRunes < memory.MaxBodyRunes {
		t.Fatalf(
			"maxInputRunes(%d) < memory.MaxBodyRunes(%d): validated bodies would be silently truncated before embedding",
			maxInputRunes, memory.MaxBodyRunes,
		)
	}
}
