package memory

// Encoding has no write, clock, economy or deletion dependency.
type EncodingService struct {
	extractor  Extractor
	embedder   Embedder
	candidates NeuronCandidateRepo
}
type EncodingDeps struct {
	Extractor  Extractor
	Embedder   Embedder
	Candidates NeuronCandidateRepo
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
	return &EncodingService{deps.Extractor, deps.Embedder, deps.Candidates}, nil
}
