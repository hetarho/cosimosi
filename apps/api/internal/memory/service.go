package memory

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrExtractorRequired  = errors.New("memory service requires an extractor")
	ErrEmbedderRequired   = errors.New("memory service requires an embedder")
	ErrCandidatesRequired = errors.New("memory service requires a neuron candidate repo")
	ErrLaunchesRequired   = errors.New("memory service requires a launch repo")
	ErrUniverseRequired   = errors.New("memory service requires a universe reader")
)

// Service owns the encode use-cases (plan 20): Encode / ReviseSplit previews and
// the PersistEncoded launch, plus the Universe read. All policy — split-count,
// semantic-neuron, dedup, caps, and the monotonic launch guard — lives here, not
// in the RPC handlers (ARCHITECTURE §2.9#7).
type Service struct {
	extractor  Extractor
	embedder   Embedder
	candidates NeuronCandidateRepo
	launches   LaunchRepo
	universe   UniverseReader
	linker     Linker
	now        func() time.Time
	newID      func() string
	newSeed    func() int64
}

type ServiceDeps struct {
	Extractor  Extractor
	Embedder   Embedder
	Candidates NeuronCandidateRepo
	Launches   LaunchRepo
	Universe   UniverseReader
	// Linker is optional until job 27 wires the real Link; nil skips the seam.
	Linker Linker
	// Now/NewID/NewSeed are test seams; nil selects the real clock and
	// crypto/rand-backed generators.
	Now     func() time.Time
	NewID   func() string
	NewSeed func() int64
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Extractor == nil {
		return nil, ErrExtractorRequired
	}
	if deps.Embedder == nil {
		return nil, ErrEmbedderRequired
	}
	if deps.Candidates == nil {
		return nil, ErrCandidatesRequired
	}
	if deps.Launches == nil {
		return nil, ErrLaunchesRequired
	}
	if deps.Universe == nil {
		return nil, ErrUniverseRequired
	}
	service := &Service{
		extractor:  deps.Extractor,
		embedder:   deps.Embedder,
		candidates: deps.Candidates,
		launches:   deps.Launches,
		universe:   deps.Universe,
		linker:     deps.Linker,
		now:        deps.Now,
		newID:      deps.NewID,
		newSeed:    deps.NewSeed,
	}
	if service.now == nil {
		service.now = func() time.Time { return time.Now().UTC() }
	}
	if service.newID == nil {
		service.newID = platform.NewID
	}
	if service.newSeed == nil {
		service.newSeed = randomSeed
	}
	return service, nil
}

func randomSeed() int64 {
	var buf [8]byte
	_, _ = rand.Read(buf[:])
	// Clear the sign bit: the seed is a visual form hint and stays non-negative
	// so FE hashing math never sees a negative value.
	return int64(binary.BigEndian.Uint64(buf[:]) &^ (1 << 63))
}
