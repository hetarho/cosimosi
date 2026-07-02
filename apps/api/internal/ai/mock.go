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

func mockExtract(body string, salt string) memory.ExtractResult {
	tokens := bodyTokens(body)
	name := mockEngramName(tokens)
	neurons := []memory.ExtractedNeuron{
		{Name: tokenAt(tokens, 0, "engram"), Type: memory.NeuronTypeSemantic},
		{Name: tokenAt(tokens, 1, "place"), Type: memory.NeuronTypeSpatial},
		{Name: tokenAt(tokens, 2, "person"), Type: memory.NeuronTypeEntity},
	}
	if salt != "" {
		name = mockEngramName(bodyTokens(name + " " + salt))
	}
	return memory.ExtractResult{
		Memories: []memory.ExtractedMemory{
			{
				Name:    name,
				Mood:    mockMood(body + salt),
				Neurons: neurons,
			},
		},
	}
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
