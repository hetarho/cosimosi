package main

import (
	"testing"

	"github.com/cosimosi/api/internal/ai"
)

func TestDeepSeekRegisteredInProductionWorker(t *testing.T) {
	if !ai.ImplementedLLM("deepseek") {
		t.Fatal(`"deepseek" LLM adapter is not registered`)
	}
}
