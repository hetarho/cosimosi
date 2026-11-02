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
	ErrUserZoneRequired         = errors.New("memory service requires a user zone reader")
)

// ReadService answers the free graph reads: the universe snapshot, a memory's provenance, the diary
// archive and calendar, and the sync status. None advances the clock or spends ([T3]).
type ReadService struct {
	universe   UniverseReader
	provenance ProvenanceReader
	diaries    DiaryReader
	clock      SpendSignalRepo
	userZone   UserZone
	now        func() time.Time
}

type ReadDeps struct {
	Universe   UniverseReader
	Provenance ProvenanceReader
	Diaries    DiaryReader
	// Clock reads the stored universe clock the sync status compares with today; UserZone decides
	// that today. UTCUserZone is the named binding for roots without profiles.
	Clock    SpendSignalRepo
	UserZone UserZone
	Now      func() time.Time
}

func NewReadService(deps ReadDeps) (*ReadService, error) {
	if deps.Universe == nil {
		return nil, ErrUniverseRequired
	}
	if deps.Provenance == nil {
		return nil, ErrProvenanceRequired
	}
	if deps.Diaries == nil {
		return nil, ErrDiariesRequired
	}
	if deps.Clock == nil {
		return nil, ErrSignalsRequired
	}
	if deps.UserZone == nil {
		return nil, ErrUserZoneRequired
	}
	service := &ReadService{
		universe:   deps.Universe,
		provenance: deps.Provenance,
		diaries:    deps.Diaries,
		clock:      deps.Clock,
		userZone:   deps.UserZone,
		now:        deps.Now,
	}
	if service.now == nil {
		service.now = func() time.Time { return time.Now().UTC() }
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
