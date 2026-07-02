package memory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

var (
	ErrJobUserRequired = errors.New("memory job requires a user id")
	ErrJobPayload      = errors.New("memory job payload invalid")
)

type EmbedJobPayload struct {
	Neurons []EmbedJobNeuron `json:"neurons"`
}

type EmbedJobNeuron struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type SemanticizeJobPayload struct {
	MemoryID    string              `json:"memory_id"`
	Name        string              `json:"name"`
	CurrentText string              `json:"current_text"`
	Mood        Mood                `json:"mood"`
	Neurons     []SemanticJobNeuron `json:"neurons"`
}

type SemanticJobNeuron struct {
	Name string     `json:"name"`
	Type NeuronType `json:"type"`
}

func NewEmbedJobHandler(embedder Embedder, writer EmbeddingWriter) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if job.UserID == "" {
			return ErrJobUserRequired
		}
		var payload EmbedJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		texts := make([]string, 0, len(payload.Neurons))
		neuronIDs := make([]string, 0, len(payload.Neurons))
		for _, neuron := range payload.Neurons {
			if neuron.ID == "" || neuron.Text == "" {
				return fmt.Errorf("%w: embed neuron requires id and text", ErrJobPayload)
			}
			neuronIDs = append(neuronIDs, neuron.ID)
			texts = append(texts, neuron.Text)
		}
		if len(texts) == 0 {
			return nil
		}
		vectors, err := embedder.Embed(ctx, texts)
		if err != nil {
			return err
		}
		if len(vectors) != len(neuronIDs) {
			return fmt.Errorf("%w: embedder returned %d vectors for %d neurons", ErrJobPayload, len(vectors), len(neuronIDs))
		}
		embeddings := make([]Embedding, 0, len(vectors))
		for i, vector := range vectors {
			embeddings = append(embeddings, Embedding{
				NeuronID: neuronIDs[i],
				Vector:   vector,
			})
		}
		return writer.UpsertEmbeddings(ctx, job.UserID, embeddings)
	}
}

func NewSemanticizeJobHandler(semanticizer Semanticizer, writer SemanticStagesWriter) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if job.UserID == "" {
			return ErrJobUserRequired
		}
		var payload SemanticizeJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		if payload.MemoryID == "" {
			return fmt.Errorf("%w: semanticize payload requires memory_id", ErrJobPayload)
		}
		neurons := make([]ExtractedNeuron, 0, len(payload.Neurons))
		for _, neuron := range payload.Neurons {
			neurons = append(neurons, ExtractedNeuron{
				Name: neuron.Name,
				Type: neuron.Type,
			})
		}
		stages, err := semanticizer.GenerateSemanticStages(ctx, SemanticizeMemory{
			ID:          payload.MemoryID,
			Name:        payload.Name,
			CurrentText: payload.CurrentText,
			Mood:        payload.Mood,
			Neurons:     neurons,
		})
		if err != nil {
			return err
		}
		return writer.SaveSemanticStages(ctx, job.UserID, payload.MemoryID, stages)
	}
}

func decodePayload(raw []byte, out any) error {
	if len(raw) == 0 {
		return fmt.Errorf("%w: empty payload", ErrJobPayload)
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("%w: %v", ErrJobPayload, err)
	}
	return nil
}
