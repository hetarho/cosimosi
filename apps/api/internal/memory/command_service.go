package memory

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

// The graph commands are three services sized to their use cases, so a change to one constructs and
// tests only its own collaborators: launching a diary (with the clock advance it causes), the paid
// actions, and releasing memories.

// graphClock is the real-clock and progression behavior a launch and the paid actions share:
// resolving the user's today, advancing the universe clock with its progression hook, and
// enqueueing the follow-up jobs.
type graphClock struct {
	progression AdvanceProgression
	userZone    UserZone
	now         func() time.Time
	newID       func() string
}

func newGraphClock(progression AdvanceProgression, zone UserZone, now func() time.Time, newID func() string) (graphClock, error) {
	if progression == nil {
		return graphClock{}, ErrProgressionRequired
	}
	if zone == nil {
		return graphClock{}, ErrUserZoneRequired
	}
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	if newID == nil {
		newID = platform.NewID
	}
	return graphClock{progression: progression, userZone: zone, now: now, newID: newID}, nil
}

func (s *graphClock) userToday(ctx context.Context, scope platform.UserScope) (time.Time, error) {
	return resolveUserToday(ctx, s.userZone, s.now(), scope)
}

// resolveUserToday is the user's calendar date at now in their profile zone, as a UTC-midnight date.
func resolveUserToday(ctx context.Context, zones UserZone, now time.Time, scope platform.UserScope) (time.Time, error) {
	location, err := zones.ZoneFor(ctx, scope)
	if err != nil {
		return time.Time{}, err
	}
	return dateInLocation(now, location), nil
}

func (s *graphClock) enqueue(ctx context.Context, scope platform.UserScope, tx ProgressionTx, kind jobqueue.Kind, payload any, targets ...jobqueue.Target) error {
	return enqueueJob(ctx, tx, scope, s.newID(), s.now(), kind, payload, targets...)
}

func seedOrRandom(newSeed func() int64) func() int64 {
	if newSeed == nil {
		return randomSeed
	}
	return newSeed
}

// LaunchService persists a confirmed split as launched memories and advances the clock to today.
type LaunchService struct {
	graphClock
	launches         LaunchRepo
	linker           Linker
	signupSettlement SignupSettlementPort
	newSeed          func() int64
}

type LaunchDeps struct {
	Launches         LaunchRepo
	Linker           Linker
	Progression      AdvanceProgression
	SignupSettlement SignupSettlementPort
	UserZone         UserZone
	Now              func() time.Time
	NewID            func() string
	NewSeed          func() int64
}

func NewLaunchService(deps LaunchDeps) (*LaunchService, error) {
	if deps.Launches == nil {
		return nil, ErrLaunchesRequired
	}
	if deps.Linker == nil {
		return nil, ErrLinkerRequired
	}
	if deps.SignupSettlement == nil {
		return nil, ErrSignupSettlementRequired
	}
	clock, err := newGraphClock(deps.Progression, deps.UserZone, deps.Now, deps.NewID)
	if err != nil {
		return nil, err
	}
	return &LaunchService{
		graphClock:       clock,
		launches:         deps.Launches,
		linker:           deps.Linker,
		signupSettlement: deps.SignupSettlement,
		newSeed:          seedOrRandom(deps.NewSeed),
	}, nil
}

// PaidActionService runs the three paid actions: recall, whole-diary recall and gist view.
type PaidActionService struct {
	graphClock
	recalls         RecallRepo
	viewSemantics   ViewSemanticRepo
	predictionError PredictionError
	newSeed         func() int64
}

type PaidActionDeps struct {
	Recalls         RecallRepo
	ViewSemantics   ViewSemanticRepo
	PredictionError PredictionError
	Progression     AdvanceProgression
	UserZone        UserZone
	Now             func() time.Time
	NewID           func() string
	NewSeed         func() int64
}

func NewPaidActionService(deps PaidActionDeps) (*PaidActionService, error) {
	if deps.Recalls == nil {
		return nil, ErrRecallsRequired
	}
	if deps.ViewSemantics == nil {
		return nil, ErrViewSemanticsRequired
	}
	if deps.PredictionError == nil {
		return nil, ErrPredictionErrorRequired
	}
	clock, err := newGraphClock(deps.Progression, deps.UserZone, deps.Now, deps.NewID)
	if err != nil {
		return nil, err
	}
	return &PaidActionService{
		graphClock:      clock,
		recalls:         deps.Recalls,
		viewSemantics:   deps.ViewSemantics,
		predictionError: deps.PredictionError,
		newSeed:         seedOrRandom(deps.NewSeed),
	}, nil
}

// ReleaseService releases, restores and lets go of memories and runs the retention sweep.
type ReleaseService struct {
	releases      ReleaseRepo
	sealSuggester SealSuggester
	now           func() time.Time
	newID         func() string
}

type ReleaseDeps struct {
	Releases      ReleaseRepo
	SealSuggester SealSuggester
	Now           func() time.Time
	NewID         func() string
}

func NewReleaseService(deps ReleaseDeps) (*ReleaseService, error) {
	if deps.Releases == nil {
		return nil, ErrReleasesRequired
	}
	if deps.SealSuggester == nil {
		return nil, ErrSealSuggesterRequired
	}
	service := &ReleaseService{releases: deps.Releases, sealSuggester: deps.SealSuggester, now: deps.Now, newID: deps.NewID}
	if service.now == nil {
		service.now = func() time.Time { return time.Now().UTC() }
	}
	if service.newID == nil {
		service.newID = platform.NewID
	}
	return service, nil
}
