package memory

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"time"
)

var (
	ErrExtractorRequired        = errors.New("memory service requires an extractor")
	ErrEmbedderRequired         = errors.New("memory service requires an embedder")
	ErrCandidatesRequired       = errors.New("memory service requires a neuron candidate repo")
	ErrLaunchesRequired         = errors.New("memory service requires a launch repo")
	ErrUniverseRequired         = errors.New("memory service requires a universe reader")
	ErrLinkerRequired           = errors.New("memory service requires a linker")
	ErrProgressionRequired      = errors.New("memory service requires an advance progression hook")
	ErrRecallsRequired          = errors.New("memory service requires a recall repo")
	ErrSpendGateRequired        = errors.New("memory service requires a spend gate")
	ErrEarnRequired             = errors.New("memory service requires an earn port")
	ErrAchievementsRequired     = errors.New("memory service requires an achievement recorder")
	ErrSignupSettlementRequired = errors.New("memory service requires a signup settlement port")
	ErrPredictionErrorRequired  = errors.New("memory service requires a prediction-error port")
	ErrGistsRequired            = errors.New("memory service requires a gist reader")
	ErrViewSemanticsRequired    = errors.New("memory service requires a view-semantic repo")
	ErrSignalsRequired          = errors.New("memory service requires a spend-signal repo")
	ErrProvenanceRequired       = errors.New("memory service requires a provenance reader")
	ErrExportsRequired          = errors.New("memory service requires an export reader")
	ErrDiariesRequired          = errors.New("memory service requires a diary reader")
	ErrReleasesRequired         = errors.New("memory service requires a release repo")
	ErrSealSuggesterRequired    = errors.New("memory service requires a seal suggester")
)

// Service is the compatibility facade over encoding, graph commands and free reads.
// New callers construct the capability they consume; roots may compose all RPC capabilities.
type Service struct {
	*EncodingService
	*CommandService
	universe   UniverseReader
	gists      GistReader
	signals    SpendSignalRepo
	provenance ProvenanceReader
	exports    ExportReader
	diaries    DiaryReader
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
	// Achievements is the counter-report seam fired inside the launch/recall/view/release
	// transactions ([A6]); required (NoAchievementRecorder for achievement-less composition) so no
	// composition root can run those paths with the report seam silently unbound.
	Achievements AchievementRecorder
	// SignupSettlement is fired after a successful admitted launch commits. It is required so
	// production cannot silently omit the deferred signup/invite reward path.
	SignupSettlement SignupSettlementPort
	// Gists is the gist-view read port ([R8]); required so no composition root can
	// wire the view path without its per-user-scoped read (the quote's standalone signal).
	Gists GistReader
	// ViewSemantics runs the paid gist-view transaction (target read + receipt + spend + receipt
	// insert atomic, A3); required so no composition root can wire the paid view without its
	// transactional idempotency boundary.
	ViewSemantics ViewSemanticRepo
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
	// Diaries backs the read-only diary-reader archive page ([D2]); required so no
	// composition root wires the reader without its per-user-scoped read (a free read).
	Diaries DiaryReader
	// Releases runs the release/restore/letting-go/sweep transaction and the letting-go
	// candidate reads; SealSuggester is the AI seal-candidate suggester (keyless mock when
	// no key, [X6]). Both required so no composition root wires the delete path without its
	// repository or its AI seam — the domain executes, the AI only suggests.
	Releases      ReleaseRepo
	SealSuggester SealSuggester
	// UserZone resolves the real-clock day boundary. Nil selects UTCUserZone, preserving the
	// shipped behavior for minimal roots while production binds account's published zone.
	UserZone UserZone
	// Now/NewID/NewSeed are test seams; nil selects the real clock and
	// crypto/rand-backed generators.
	Now     func() time.Time
	NewID   func() string
	NewSeed func() int64
}

type ReadServiceDeps struct {
	Universe   UniverseReader
	Gists      GistReader
	Signals    SpendSignalRepo
	Provenance ProvenanceReader
	Exports    ExportReader
	Diaries    DiaryReader
}

func NewService(deps ServiceDeps) (*Service, error) {
	encoding, err := NewEncodingService(EncodingDeps{Extractor: deps.Extractor, Embedder: deps.Embedder, Candidates: deps.Candidates})
	if err != nil {
		return nil, err
	}
	commands, err := NewCommandService(CommandDeps{
		Launches:         deps.Launches,
		Linker:           deps.Linker,
		Progression:      deps.Progression,
		Recalls:          deps.Recalls,
		SpendGate:        deps.SpendGate,
		Earn:             deps.Earn,
		Achievements:     deps.Achievements,
		SignupSettlement: deps.SignupSettlement,
		PredictionError:  deps.PredictionError,
		ViewSemantics:    deps.ViewSemantics,
		Releases:         deps.Releases,
		SealSuggester:    deps.SealSuggester,
		UserZone:         deps.UserZone,
		Now:              deps.Now,
		NewID:            deps.NewID,
		NewSeed:          deps.NewSeed,
	})
	if err != nil {
		return nil, err
	}
	return NewServiceWithCapabilities(encoding, commands, ReadServiceDeps{
		Universe:   deps.Universe,
		Gists:      deps.Gists,
		Signals:    deps.Signals,
		Provenance: deps.Provenance,
		Exports:    deps.Exports,
		Diaries:    deps.Diaries,
	})
}

func NewServiceWithCapabilities(encoding *EncodingService, commands *CommandService, reads ReadServiceDeps) (*Service, error) {
	if encoding == nil {
		return nil, ErrExtractorRequired
	}
	if commands == nil {
		return nil, ErrLaunchesRequired
	}
	if reads.Universe == nil {
		return nil, ErrUniverseRequired
	}
	if reads.Gists == nil {
		return nil, ErrGistsRequired
	}
	if reads.Signals == nil {
		return nil, ErrSignalsRequired
	}
	if reads.Provenance == nil {
		return nil, ErrProvenanceRequired
	}
	if reads.Exports == nil {
		return nil, ErrExportsRequired
	}
	if reads.Diaries == nil {
		return nil, ErrDiariesRequired
	}
	return &Service{EncodingService: encoding, CommandService: commands,
		universe:   reads.Universe,
		gists:      reads.Gists,
		signals:    reads.Signals,
		provenance: reads.Provenance,
		exports:    reads.Exports,
		diaries:    reads.Diaries,
	}, nil
}

func randomSeed() int64 {
	var buf [8]byte
	_, _ = rand.Read(buf[:])
	// Clear the sign bit: the seed is a visual form hint and stays non-negative
	// so FE hashing math never sees a negative value.
	return int64(binary.BigEndian.Uint64(buf[:]) &^ (1 << 63))
}
