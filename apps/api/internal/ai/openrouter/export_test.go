package openrouter

import "github.com/cosimosi/api/internal/ai"

// NewCandidateClient is the evaluation harness's way to a model the allowlist has not admitted yet
// (AI-19): the same transport `New` builds, without the allowlist check. It exists only in test
// builds, so no production root can construct an unreviewed model.
func NewCandidateClient(cfg ai.ProviderConfig) (ai.LLMClient, error) {
	return newClient(cfg, cfg.Model, "")
}
