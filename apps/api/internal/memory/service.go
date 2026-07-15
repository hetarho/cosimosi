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
	ErrEarnRequired            = errors.New("memory service requires an earn port")
	ErrPredictionErrorRequired = errors.New("memory service requires a prediction-error port")
	ErrGistsRequired           = errors.New("memory service requires a gist reader")
	ErrSignalsRequired         = errors.New("memory service requires a spend-signal repo")
	ErrProvenanceRequired      = errors.New("memory service requires a provenance reader")
	ErrExportsRequired         = errors.New("memory service requires an export reader")
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
	earn            EarnPort
	predictionError PredictionError
	gists           GistReader
	signals         SpendSignalRepo
	provenance      ProvenanceReader
	exports         ExportReader
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
	// (AllowAllSpendGate for economy-less composition, the real gate at cmd/api);
	// PredictionError is the LLM semantic-compare deciding reinforce vs.
	// reconsolidate. All required so no composition root can wire a recall path
	// missing its economy or its gate.
	Recalls         RecallRepo
	SpendGate       SpendGate
	PredictionError PredictionError
	// Earn is the write-earn seam fired inside the launch transaction ([G3]);
	// required (NoEarnOnWrite for economy-less composition) so no composition root
	// can launch diaries with the grant seam silently unbound.
	Earn EarnPort
	// Gists is the gist-view read port ([R8]); required so no composition root can
	// wire the view path without its per-user-scoped read.
	Gists GistReader
	// Signals backs the published spend-signal reads the economy's quote consumes;
	// required so no composition root can register the quote against a service that
	// cannot resolve its depth signals.
	Signals SpendSignalRepo
	// Provenance backs the read-only 변천사 read (baseline facts + appended history);
	// Exports backs the whole-account read (retained diaries + still-live memories).
	// Both required so no composition root wires the read/export path without its
	// per-user-scoped reads; both are pure reads with no economy seam.
	Provenance ProvenanceReader
	Exports    ExportReader
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
	if deps.Earn == nil {
		return nil, ErrEarnRequired
	}
	if deps.PredictionError == nil {
		return nil, ErrPredictionErrorRequired
	}
	if deps.Gists == nil {
		return nil, ErrGistsRequired
	}
	if deps.Signals == nil {
		return nil, ErrSignalsRequired
	}
	if deps.Provenance == nil {
		return nil, ErrProvenanceRequired
	}
	if deps.Exports == nil {
		return nil, ErrExportsRequired
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
		earn:            deps.Earn,
		predictionError: deps.PredictionError,
		gists:           deps.Gists,
		signals:         deps.Signals,
		provenance:      deps.Provenance,
		exports:         deps.Exports,
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
