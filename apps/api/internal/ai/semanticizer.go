package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform/values"
)

type RealSemanticizer struct {
	client LLMClient
	meter  *Meter
	mu     sync.Mutex
	cache  boundedCache[memory.SemanticStages]
}

func NewRealSemanticizer(client LLMClient, meter *Meter) (*RealSemanticizer, error) {
	if client == nil {
		return nil, ErrLLMClientRequired
	}
	if meter == nil {
		meter = NewMeter()
	}
	return &RealSemanticizer{
		client: client,
		meter:  meter,
		cache:  newBoundedCache[memory.SemanticStages](aiAdapterCacheMaxEntries),
	}, nil
}

func (s *RealSemanticizer) GenerateSemanticStages(ctx context.Context, item memory.SemanticizeMemory) (memory.SemanticStages, error) {
	userID, err := s.meter.UserID(ctx)
	if err != nil {
		return memory.SemanticStages{}, err
	}
	key := stableHash("semanticize", userID, item)
	if cached, ok := s.cached(key); ok {
		return cached, nil
	}
	userID, err = s.meter.Charge(ctx)
	if err != nil {
		return memory.SemanticStages{}, err
	}
	resp, err := s.client.CompleteJSON(ctx, LLMRequest{
		UserID:          userID,
		Prompt:          semanticizePrompt(item),
		MaxOutputTokens: values.AiPerCallTokenCap,
		OutputSchema:    SemanticStagesOutputSchema(),
		CacheKey:        key,
	})
	if err != nil {
		return memory.SemanticStages{}, err
	}
	stages, err := parseSemanticStages(resp.JSON)
	if err != nil {
		return memory.SemanticStages{}, err
	}
	s.store(key, stages)
	return stages, nil
}

func (s *RealSemanticizer) cached(key string) (memory.SemanticStages, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	stages, ok := s.cache.get(key)
	return stages, ok
}

func (s *RealSemanticizer) store(key string, stages memory.SemanticStages) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache.put(key, stages)
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
