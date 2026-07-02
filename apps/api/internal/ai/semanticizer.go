package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/cosimosi/api/internal/memory"
)

type RealSemanticizer struct {
	client LLMClient
}

func NewRealSemanticizer(client LLMClient) (*RealSemanticizer, error) {
	if client == nil {
		return nil, ErrLLMClientRequired
	}
	return &RealSemanticizer{client: client}, nil
}

func (s *RealSemanticizer) GenerateSemanticStages(ctx context.Context, item memory.SemanticizeMemory) (memory.SemanticStages, error) {
	key := stableHash("semanticize", item)
	resp, err := s.client.CompleteJSON(ctx, LLMRequest{
		Prompt:       semanticizePrompt(item),
		OutputSchema: SemanticStagesOutputSchema(),
		CacheKey:     key,
		Validate:     func(body []byte) error { _, err := parseSemanticStages(body); return err },
	})
	if err != nil {
		return memory.SemanticStages{}, err
	}
	return parseSemanticStages(resp.JSON)
}

type semanticStagesJSON struct {
	Stages []string `json:"stages"`
}

func parseSemanticStages(raw []byte) (memory.SemanticStages, error) {
	var envelope semanticStagesJSON
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return memory.SemanticStages{}, err
	}
	if len(envelope.Stages) != len(memory.SemanticStages{}) {
		return memory.SemanticStages{}, fmt.Errorf("semanticizer returned %d stages, want %d", len(envelope.Stages), len(memory.SemanticStages{}))
	}
	var stages memory.SemanticStages
	for i, value := range envelope.Stages {
		value = strings.TrimSpace(value)
		if value == "" {
			return memory.SemanticStages{}, errors.New("semanticizer stage text must not be empty")
		}
		stages[i] = value
	}
	return stages, nil
}

func SemanticStagesOutputSchema() JSONSchema {
	return JSONSchema{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"stages"},
		"properties": map[string]any{
			"stages": map[string]any{
				"type":     "array",
				"minItems": 4,
				"maxItems": 4,
				"items":    map[string]any{"type": "string"},
			},
		},
	}
}

func semanticizePrompt(item memory.SemanticizeMemory) string {
	return fmt.Sprintf(
		"Generate four semanticization stage texts for this engram. Return only JSON matching the provided schema. Engram: %+v",
		item,
	)
}
