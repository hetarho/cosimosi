package memory

import "log"

// Encoding has no write, clock, economy or deletion dependency.
type EncodingService struct {
	extractor  Extractor
	embedder   Embedder
	candidates NeuronCandidateRepo
	logger     *log.Logger
}
type EncodingDeps struct {
	Extractor  Extractor
	Embedder   Embedder
	Candidates NeuronCandidateRepo
	// Logger records a degraded dedup assist; nil selects the standard logger.
	Logger *log.Logger
}

func NewEncodingService(deps EncodingDeps) (*EncodingService, error) {
	if deps.Extractor == nil {
		return nil, ErrExtractorRequired
	}
	if deps.Embedder == nil {
		return nil, ErrEmbedderRequired
	}
	if deps.Candidates == nil {
		return nil, ErrCandidatesRequired
	}
	logger := deps.Logger
	if logger == nil {
		logger = log.Default()
	}
	return &EncodingService{deps.Extractor, deps.Embedder, deps.Candidates, logger}, nil
}
