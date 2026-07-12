package memory

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrExtractorRequired       = errors.New("memory service requires an extractor")
	ErrEmbedderRequired        = errors.New("memory service requires an embedder")
	ErrCandidatesRequired      = errors.New("memory service requires a neuron candidate repo")
	ErrLaunchesRequired        = errors.New("memory service requires a launch repo")
	ErrUniverseRequired        = errors.New("memory service requires a universe reader")
	ErrLinkerRequired          = errors.New("memory service requires a linker")
	ErrProgressionRequired     = errors.New("memory service requires an advance progression hook")
	ErrRecallsRequired         = errors.New("memory service requires a recall repo")
	ErrSpendGateRequired       = errors.New("memory service requires a spend gate")
	ErrPredictionErrorRequired = errors.New("memory service requires a prediction-error port")
	ErrGistsRequired           = errors.New("memory service requires a gist reader")
)

// Service owns the encode use-cases: Encode / ReviseSplit previews and
// the PersistEncoded launch, plus the Universe read. All policy — split-count,
// semantic-neuron, dedup, caps, and the monotonic launch guard — lives here, not
// in the RPC handlers (ARCHITECTURE §2.9#7).
type Service struct {
	extractor       Extractor
	embedder        Embedder
	candidates      NeuronCandidateRepo
	launches        LaunchRepo
	universe        UniverseReader
	linker          Linker
	progression     AdvanceProgression
	recalls         RecallRepo
	spendGate       SpendGate
	predictionError PredictionError
	gists           GistReader
	now             func() time.Time
	newID           func() string
	newSeed         func() int64
}

type ServiceDeps struct {
	Extractor  Extractor
	Embedder   Embedder
	Candidates NeuronCandidateRepo
	Launches   LaunchRepo
	Universe   UniverseReader
	// Linker wires synapses as the last step of PersistEncoded; it is
	// required so no composition root can launch memories without growing the graph.
	Linker Linker
	// Progression is the read-time progression hook fired when the clock moves
	// ([T4]); required (the default binding is NoopAdvanceProgression) so no
	// composition root can advance the clock without the seam the
	// advance-triggered handlers hang their work on.
	Progression AdvanceProgression
	// Recalls runs the recall transaction; SpendGate gates the Twinkle spend
	// (allow-all no-op default, real gate rebinds later); PredictionError is the LLM
	// semantic-compare deciding reinforce vs. reconsolidate. All required so no
	// composition root can wire a recall path missing its economy or its gate.
	Recalls         RecallRepo
	SpendGate       SpendGate
	PredictionError PredictionError
	// Gists is the gist-view read port ([R8]); required so no composition root can
	// wire the view path without its per-user-scoped read.
	Gists GistReader
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
	if deps.Linker == nil {
		return nil, ErrLinkerRequired
	}
	if deps.Progression == nil {
		return nil, ErrProgressionRequired
	}
	if deps.Recalls == nil {
		return nil, ErrRecallsRequired
	}
	if deps.SpendGate == nil {
		return nil, ErrSpendGateRequired
	}
	if deps.PredictionError == nil {
		return nil, ErrPredictionErrorRequired
	}
	if deps.Gists == nil {
		return nil, ErrGistsRequired
	}
	service := &Service{
		extractor:       deps.Extractor,
		embedder:        deps.Embedder,
		candidates:      deps.Candidates,
		launches:        deps.Launches,
		universe:        deps.Universe,
		linker:          deps.Linker,
		progression:     deps.Progression,
		recalls:         deps.Recalls,
		spendGate:       deps.SpendGate,
		predictionError: deps.PredictionError,
		gists:           deps.Gists,
		now:             deps.Now,
		newID:           deps.NewID,
		newSeed:         deps.NewSeed,
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
