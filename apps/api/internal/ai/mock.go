package ai

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"strings"
	"time"
	"unicode"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform/values"
)

type MockExtractor struct{}

func NewMockExtractor() MockExtractor {
	return MockExtractor{}
}

func (MockExtractor) Split(_ context.Context, body string, _ time.Time, _ []memory.ExistingNeuron) (memory.ExtractResult, error) {
	return mockExtract(body, ""), nil
}

func (MockExtractor) ReviseSplit(_ context.Context, prior memory.ExtractResult, instruction string) (memory.ExtractResult, error) {
	body := instruction
	if len(prior.Memories) > 0 {
		body = prior.Memories[0].Name + " " + instruction
	}
	return mockExtract(body, instruction), nil
}

type MockEmbedder struct{}

func NewMockEmbedder() MockEmbedder {
	return MockEmbedder{}
}

func (MockEmbedder) Embed(_ context.Context, texts []string) ([][]float32, error) {
	vectors := make([][]float32, 0, len(texts))
	for _, text := range texts {
		vectors = append(vectors, mockVector(text))
	}
	return vectors, nil
}

type MockSemanticizer struct{}

func NewMockSemanticizer() MockSemanticizer {
	return MockSemanticizer{}
}

func (MockSemanticizer) GenerateSemanticStages(_ context.Context, item memory.SemanticizeMemory) (memory.SemanticStages, error) {
	name := strings.TrimSpace(item.Name)
	if name == "" {
		name = "Untitled engram"
	}
	text := strings.TrimSpace(item.CurrentText)
	if text == "" {
		text = name
	}
	return memory.SemanticStages{
		fmt.Sprintf("%s: concrete recollection of %s", name, text),
		fmt.Sprintf("%s: reduced scene and feeling", name),
		fmt.Sprintf("%s: abstract pattern", name),
		fmt.Sprintf("%s: semantic gist", name),
	}, nil
}

// mockExtract emits values.EncodeMinMemories memories so the keyless mock
// satisfies the encode invariants the use-case enforces ([E2] count range,
// [E4] ≥1 semantic neuron per memory) instead of tripping the repair loop.
func mockExtract(body string, salt string) memory.ExtractResult {
	tokens := bodyTokens(body)
	count := values.EncodeMinMemories
	memories := make([]memory.ExtractedMemory, 0, count)
	for i := 0; i < count; i++ {
		slice := tokenSlice(tokens, i, count)
		name := mockEngramName(slice)
		if salt != "" {
			name = mockEngramName(bodyTokens(name + " " + salt))
		}
		neurons := make([]memory.ExtractedNeuron, 0, values.EncodeMinSemanticNeurons+2)
		for s := 0; s < values.EncodeMinSemanticNeurons; s++ {
			neurons = append(neurons, memory.ExtractedNeuron{
				Name: tokenAt(slice, s, fmt.Sprintf("engram %d-%d", i+1, s+1)),
				Type: memory.NeuronTypeSemantic,
			})
		}
		neurons = append(neurons,
			memory.ExtractedNeuron{
				Name: tokenAt(slice, values.EncodeMinSemanticNeurons, fmt.Sprintf("place %d", i+1)),
				Type: memory.NeuronTypeSpatial,
			},
			memory.ExtractedNeuron{
				Name: tokenAt(slice, values.EncodeMinSemanticNeurons+1, fmt.Sprintf("person %d", i+1)),
				Type: memory.NeuronTypeEntity,
			},
		)
		memories = append(memories, memory.ExtractedMemory{
			Name:    fmt.Sprintf("%s %d", name, i+1),
			Mood:    mockMood(fmt.Sprintf("%s%s%d", body, salt, i)),
			Neurons: neurons,
		})
	}
	return memory.ExtractResult{Memories: memories}
}

// tokenSlice deals the body tokens round-robin across the mock memories so each
// memory sees distinct tokens (distinct neuron names → no accidental dedup).
func tokenSlice(tokens []string, index int, count int) []string {
	slice := make([]string, 0, (len(tokens)+count-1)/count)
	for i := index; i < len(tokens); i += count {
		slice = append(slice, tokens[i])
	}
	return slice
}

func mockEngramName(tokens []string) string {
	if len(tokens) == 0 {
		return "Untitled Engram"
	}
	limit := len(tokens)
	if limit > 4 {
		limit = 4
	}
	parts := make([]string, 0, limit)
	for _, token := range tokens[:limit] {
		if token == "" {
			continue
		}
		parts = append(parts, titleToken(token))
	}
	if len(parts) == 0 {
		return "Untitled Engram"
	}
	return strings.Join(parts, " ")
}

func titleToken(token string) string {
	runes := []rune(token)
	if len(runes) == 0 {
		return ""
	}
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

func mockMood(seed string) memory.Mood {
	moods := []memory.Mood{
		memory.MoodJoy,
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
		memory.MoodEmptiness,
	}
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(seed))
	return moods[int(hash.Sum32())%len(moods)]
}

func bodyTokens(body string) []string {
	seen := make(map[string]struct{})
	tokens := make([]string, 0)
	for _, raw := range strings.Fields(body) {
		token := normalizeToken(raw)
		if token == "" {
			continue
		}
		if _, ok := seen[token]; ok {
			continue
		}
		seen[token] = struct{}{}
		tokens = append(tokens, token)
	}
	return tokens
}

func normalizeToken(value string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(value) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func tokenAt(tokens []string, index int, fallback string) string {
	if index < len(tokens) && tokens[index] != "" {
		return tokens[index]
	}
	return fallback
}

func mockVector(text string) []float32 {
	vector := make([]float32, values.AiEmbeddingDim)
	for i := range vector {
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", text, i/8)))
		offset := (i % 8) * 4
		raw := binary.BigEndian.Uint32(sum[offset : offset+4])
		vector[i] = float32(float64(raw)/float64(^uint32(0))*2 - 1)
	}
	return vector
}
