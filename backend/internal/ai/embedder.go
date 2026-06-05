// Package ai is the provider abstraction (constitution §7): the worker and
// services depend only on these ports, and concrete adapters (mock, OpenAI, …)
// are injected at the edge. Types here are pure domain — no transport/db tags.
package ai

import "context"

// Embedder turns diary text into a fixed-dimension semantic vector. The adapter
// guarantees the returned slice has length Dim() (MVP: 1536). Model() names the
// adapter/model that produced the vector so it is recorded alongside the
// embedding (acceptance 1.2) and can be re-embedded if the model/dimension ever
// changes (Architecture §4.7).
type Embedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
	Dim() int
	Model() string
}

// Extraction is the pure result of an Extractor. MVP keeps it empty (the
// Extractor is a no-op); v1 (#24) fills episodic/semantic classification,
// entities, and rich visual hints through the same port.
type Extraction struct{}
