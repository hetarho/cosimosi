package ai

import "context"

// Extractor is the (v1) LLM extraction port. MVP defines only the port and ships
// a no-op, so the embedding pipeline runs without any LLM (Architecture §4.7,
// spec 05 비목표). The real adapter — episodic/semantic classification, entities,
// rich visual attributes — slots in at v1 (#24) behind this same interface.
type Extractor interface {
	Extract(ctx context.Context, text string) (Extraction, error)
}

// NoopExtractor returns an empty Extraction. It lets the pipeline depend on the
// Extractor port today without paying for an LLM call.
type NoopExtractor struct{}

func (NoopExtractor) Extract(context.Context, string) (Extraction, error) {
	return Extraction{}, nil
}
