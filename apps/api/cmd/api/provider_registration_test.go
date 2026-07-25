package main

import (
	"testing"

	"github.com/cosimosi/api/internal/ai"
)

func TestDeepSeekRegisteredInProductionAPI(t *testing.T) {
	const provider = "deepseek"

	if !ai.ImplementedLLM(provider) {
		t.Fatalf("%q LLM adapter is not registered", provider)
	}
	if !(aiProviderCatalog{}).ImplementedLLM(provider) {
		t.Fatalf("provider catalog does not report %q as implemented", provider)
	}
}
