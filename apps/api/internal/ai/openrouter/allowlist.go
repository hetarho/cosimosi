package openrouter

import "strings"

// approvedModel is one curated LLM row: the exact OpenRouter request id and, when the catalog
// publishes one, its permanent canonical slug — the two spellings a completion may answer with.
type approvedModel struct {
	ID            string
	CanonicalSlug string
}

// approvedModels is the curated LLM catalog (AI-18). A model enters only after an approved
// evaluation in EVALUATION.md (AI-19); `TestAllowlistMatchesApprovedEvaluation` keeps the two equal.
// Empty until the evidence gate admits a model, so no production build can reach an unreviewed one.
var approvedModels = []approvedModel{}

func approved(model string) (approvedModel, bool) {
	for _, entry := range approvedModels {
		if strings.EqualFold(entry.ID, model) {
			return entry, true
		}
	}
	return approvedModel{}, false
}
