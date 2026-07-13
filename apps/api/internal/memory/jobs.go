package memory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/platform"
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
	// KeepStages/KeptStages carry the reconsolidation remaining-stage rule ([C7]): the
	// worker regenerates all four stage texts from CurrentText, then keeps the first
	// KeepStages already-risen texts from KeptStages (z-axis is one-way — a risen gist
	// stage is a thing that happened). Both are zero/nil for a launch semanticize, which
	// keeps nothing and writes all four (the pregenerated set).
	KeepStages int16           `json:"keep_stages,omitempty"`
	KeptStages *SemanticStages `json:"kept_stages,omitempty"`
}

type SemanticJobNeuron struct {
	Name string     `json:"name"`
	Type NeuronType `json:"type"`
}

// ConsolidateJobPayload is the interval-implied heavy work an advance enqueues ([C7], §2.8):
// the replayed constellation's neurons re-embed after the reorg, off the advance transaction.
// It carries neuron IDENTITY only — names are mutable (a later launch can rename a neuron),
// so the worker re-reads the authoritative texts at execution rather than embedding a
// stale enqueue-time snapshot. The interval and stage-advanced memory ids ride along as the
// marker of which consolidation produced the job.
type ConsolidateJobPayload struct {
	FromUniverseTime string   `json:"from_universe_time"`
	ToUniverseTime   string   `json:"to_universe_time"`
	MemoryIDs        []string `json:"memory_ids"`
	NeuronIDs        []string `json:"neuron_ids"`
}

// NeuronEmbedTextReader is the consolidate handler's consumer-owned read port (§2.4): the
// live (unsealed) neurons' current embed texts, resolved at job execution so a re-embed
// never writes a vector for a name that has since changed. The concrete is memory/pg.
type NeuronEmbedTextReader interface {
	NeuronEmbedTexts(ctx context.Context, userID string, neuronIDs []string) ([]ExistingNeuron, error)
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
		// A launch enqueues only genuinely-new named neurons, so an incomplete row is a
		// malformed payload here — unlike the consolidate re-embed, which may carry
		// unnamed neurons and skips them.
		texts := make([]string, 0, len(payload.Neurons))
		neuronIDs := make([]string, 0, len(payload.Neurons))
		for _, neuron := range payload.Neurons {
			if neuron.ID == "" || neuron.Text == "" {
				return fmt.Errorf("%w: embed neuron requires id and text", ErrJobPayload)
			}
			neuronIDs = append(neuronIDs, neuron.ID)
			texts = append(texts, neuron.Text)
		}
		return embedNeuronTexts(ctx, embedder, writer, job.UserID, neuronIDs, texts)
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
		// Reconsolidation keeps the already-risen gist texts and takes the freshly
		// regenerated ones for the rest ([C7]); a launch semanticize keeps none and
		// writes all four.
		if payload.KeptStages != nil {
			for i := 0; i < int(payload.KeepStages) && i < len(stages); i++ {
				stages[i] = payload.KeptStages[i]
			}
		}
		return writer.SaveSemanticStages(ctx, job.UserID, payload.MemoryID, stages)
	}
}

// NewConsolidateJobHandler drains the consolidate kind ([C4][C7]): re-embed the replayed
// constellation's neurons on their current meaning, read at execution time. Neurons that
// have vanished, sealed, or carry no usable text are skipped rather than failed — an
// unnamed neuron simply has nothing to re-embed.
func NewConsolidateJobHandler(embedder Embedder, writer EmbeddingWriter, names NeuronEmbedTextReader) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if job.UserID == "" {
			return ErrJobUserRequired
		}
		var payload ConsolidateJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		if len(payload.NeuronIDs) == 0 {
			return nil
		}
		neurons, err := names.NeuronEmbedTexts(ctx, job.UserID, payload.NeuronIDs)
		if err != nil {
			return err
		}
		texts := make([]string, 0, len(neurons))
		neuronIDs := make([]string, 0, len(neurons))
		for _, neuron := range neurons {
			if neuron.ID == "" || neuron.Name == "" {
				continue
			}
			neuronIDs = append(neuronIDs, neuron.ID)
			texts = append(texts, neuron.Name)
		}
		return embedNeuronTexts(ctx, embedder, writer, job.UserID, neuronIDs, texts)
	}
}

// embedNeuronTexts is the shared embed→upsert tail of the embed and consolidate handlers:
// one Embed call over the batch, a vector-count guard, and the per-user upsert.
func embedNeuronTexts(ctx context.Context, embedder Embedder, writer EmbeddingWriter, userID string, neuronIDs []string, texts []string) error {
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
	return writer.UpsertEmbeddings(ctx, userID, embeddings)
}

// enqueueJob marshals one payload and enqueues it on the transaction — the single job-row
// construction every enqueuing use-case shares. A zero `at` leaves the run-now timestamps
// to the store default.
func enqueueJob(ctx context.Context, tx ProgressionTx, scope platform.UserScope, id string, at time.Time, kind JobKind, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = tx.EnqueueJob(ctx, scope, Job{
		ID:        id,
		UserID:    scope.UserID(),
		Kind:      kind,
		Payload:   raw,
		Status:    JobStatusPending,
		NextRunAt: at,
		CreatedAt: at,
	})
	return err
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
