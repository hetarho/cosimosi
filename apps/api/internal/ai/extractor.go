package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform/values"
)

var ErrLLMClientRequired = errors.New("ai real extractor requires an llm client")

type RealExtractor struct {
	client LLMClient
	meter  *Meter
	mu     sync.Mutex
	cache  boundedCache[memory.ExtractResult]
}

func NewRealExtractor(client LLMClient, meter *Meter) (*RealExtractor, error) {
	if client == nil {
		return nil, ErrLLMClientRequired
	}
	if meter == nil {
		meter = NewMeter()
	}
	return &RealExtractor{
		client: client,
		meter:  meter,
		cache:  newBoundedCache[memory.ExtractResult](aiAdapterCacheMaxEntries),
	}, nil
}

func (a *RealExtractor) Split(ctx context.Context, body string, diaryDate time.Time, existingNeurons []memory.ExistingNeuron) (memory.ExtractResult, error) {
	inputKey := stableHash("split", body, diaryDate.Format(time.DateOnly), existingNeurons)
	return a.completeExtract(ctx, inputKey, splitPrompt(body, diaryDate, existingNeurons))
}

func (a *RealExtractor) ReviseSplit(ctx context.Context, prior memory.ExtractResult, instruction string) (memory.ExtractResult, error) {
	inputKey := stableHash("revise", prior, instruction)
	return a.completeExtract(ctx, inputKey, revisePrompt(prior, instruction))
}

func (a *RealExtractor) completeExtract(ctx context.Context, inputKey string, prompt string) (memory.ExtractResult, error) {
	userID, err := a.meter.UserID(ctx)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	cacheKey := stableHash(userID, inputKey)
	if cached, ok := a.cached(cacheKey); ok {
		return cached, nil
	}
	userID, err = a.meter.Charge(ctx)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	resp, err := a.client.CompleteJSON(ctx, LLMRequest{
		UserID:          userID,
		Prompt:          prompt,
		MaxOutputTokens: values.AiPerCallTokenCap,
		OutputSchema:    ExtractOutputSchema(),
		CacheKey:        cacheKey,
	})
	if err != nil {
		return memory.ExtractResult{}, err
	}
	result, err := parseExtractResult(resp.JSON)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	a.store(cacheKey, result)
	return result, nil
}

func (a *RealExtractor) cached(key string) (memory.ExtractResult, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	result, ok := a.cache.get(key)
	return copyExtractResult(result), ok
}

func (a *RealExtractor) store(key string, result memory.ExtractResult) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.cache.put(key, copyExtractResult(result))
}

type extractEnvelopeJSON struct {
	Memories []extractMemoryJSON `json:"memories"`
}

type extractMemoryJSON struct {
	Name    string              `json:"name"`
	Mood    string              `json:"mood"`
	Neurons []extractNeuronJSON `json:"neurons"`
}

type extractNeuronJSON struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func parseExtractResult(raw []byte) (memory.ExtractResult, error) {
	var envelope extractEnvelopeJSON
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return memory.ExtractResult{}, err
	}
	if len(envelope.Memories) == 0 {
		return memory.ExtractResult{}, errors.New("extractor response contains no memories")
	}
	result := memory.ExtractResult{Memories: make([]memory.ExtractedMemory, 0, len(envelope.Memories))}
	for _, item := range envelope.Memories {
		if strings.TrimSpace(item.Name) == "" {
			return memory.ExtractResult{}, errors.New("extractor response memory requires name")
		}
		mood, err := normalizeMood(item.Mood)
		if err != nil {
			return memory.ExtractResult{}, err
		}
		neurons := make([]memory.ExtractedNeuron, 0, len(item.Neurons))
		for _, neuron := range item.Neurons {
			if strings.TrimSpace(neuron.Name) == "" || strings.TrimSpace(neuron.Type) == "" {
				return memory.ExtractResult{}, errors.New("extractor response neuron requires name and type")
			}
			neuronType, err := normalizeNeuronType(neuron.Type)
			if err != nil {
				return memory.ExtractResult{}, err
			}
			neurons = append(neurons, memory.ExtractedNeuron{
				Name: strings.TrimSpace(neuron.Name),
				Type: neuronType,
			})
		}
		result.Memories = append(result.Memories, memory.ExtractedMemory{
			Name:    strings.TrimSpace(item.Name),
			Mood:    mood,
			Neurons: neurons,
		})
	}
	return result, nil
}

func normalizeMood(value string) (memory.Mood, error) {
	mood := memory.Mood(strings.ToUpper(strings.TrimSpace(value)))
	switch mood {
	case memory.MoodJoy,
		memory.MoodCalm,
		memory.MoodSad,
		memory.MoodAnger,
		memory.MoodFear,
		memory.MoodLove,
		memory.MoodNeutral,
		memory.MoodExcitement,
		memory.MoodGratitude,
		memory.MoodRelief,
		memory.MoodStress,
		memory.MoodTired,
		memory.MoodEmptiness:
		return mood, nil
	default:
		return "", fmt.Errorf("extractor response mood %q is not supported", value)
	}
}

func normalizeNeuronType(value string) (memory.NeuronType, error) {
	neuronType := memory.NeuronType(strings.ToLower(strings.TrimSpace(value)))
	switch neuronType {
	case memory.NeuronTypeSemantic, memory.NeuronTypeSpatial, memory.NeuronTypeEntity:
		return neuronType, nil
	default:
		return "", fmt.Errorf("extractor response neuron type %q is not supported", value)
	}
}

func ExtractOutputSchema() JSONSchema {
	return JSONSchema{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"memories"},
		"properties": map[string]any{
			"memories": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"name", "mood", "neurons"},
					"properties": map[string]any{
						"name": map[string]any{"type": "string"},
						"mood": map[string]any{"type": "string"},
						"neurons": map[string]any{
							"type": "array",
							"items": map[string]any{
								"type":                 "object",
								"additionalProperties": false,
								"required":             []string{"name", "type"},
								"properties": map[string]any{
									"name": map[string]any{"type": "string"},
									"type": map[string]any{"type": "string"},
								},
							},
						},
					},
				},
			},
		},
	}
}

func splitPrompt(body string, diaryDate time.Time, existingNeurons []memory.ExistingNeuron) string {
	return fmt.Sprintf(
		"Split this diary into episodic memories. Return only JSON matching the provided schema. Diary date: %s. Existing neurons: %v. Diary: %s",
		diaryDate.Format(time.DateOnly),
		existingNeurons,
		body,
	)
}

func revisePrompt(prior memory.ExtractResult, instruction string) string {
	return fmt.Sprintf(
		"Revise this prior split using the natural-language instruction. Return only JSON matching the provided schema. Prior: %+v. Instruction: %s",
		prior,
		instruction,
	)
}

func copyExtractResult(result memory.ExtractResult) memory.ExtractResult {
	copied := memory.ExtractResult{Memories: make([]memory.ExtractedMemory, 0, len(result.Memories))}
	for _, item := range result.Memories {
		neurons := append([]memory.ExtractedNeuron(nil), item.Neurons...)
		copied.Memories = append(copied.Memories, memory.ExtractedMemory{
			Name:    item.Name,
			Mood:    item.Mood,
			Neurons: neurons,
		})
	}
	return copied
}
