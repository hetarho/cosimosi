package memory

import (
	"github.com/cosimosi/api/internal/platform"
	"time"
)

type CommandService struct {
	launches         LaunchRepo
	linker           Linker
	progression      AdvanceProgression
	recalls          RecallRepo
	spendGate        SpendGate
	earn             EarnPort
	achievements     AchievementRecorder
	signupSettlement SignupSettlementPort
	predictionError  PredictionError
	viewSemantics    ViewSemanticRepo
	releases         ReleaseRepo
	sealSuggester    SealSuggester
	userZone         UserZone
	now              func() time.Time
	newID            func() string
	newSeed          func() int64
}

type CommandDeps struct {
	Launches         LaunchRepo
	Linker           Linker
	Progression      AdvanceProgression
	Recalls          RecallRepo
	SpendGate        SpendGate
	Earn             EarnPort
	Achievements     AchievementRecorder
	SignupSettlement SignupSettlementPort
	PredictionError  PredictionError
	ViewSemantics    ViewSemanticRepo
	Releases         ReleaseRepo
	SealSuggester    SealSuggester
	UserZone         UserZone
	Now              func() time.Time
	NewID            func() string
	NewSeed          func() int64
}

func NewCommandService(deps CommandDeps) (*CommandService, error) {
	if deps.Launches == nil {
		return nil, ErrLaunchesRequired
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
	if deps.Achievements == nil {
		return nil, ErrAchievementsRequired
	}
	if deps.SignupSettlement == nil {
		return nil, ErrSignupSettlementRequired
	}
	if deps.PredictionError == nil {
		return nil, ErrPredictionErrorRequired
	}
	if deps.ViewSemantics == nil {
		return nil, ErrViewSemanticsRequired
	}
	if deps.Releases == nil {
		return nil, ErrReleasesRequired
	}
	if deps.SealSuggester == nil {
		return nil, ErrSealSuggesterRequired
	}
	if deps.UserZone == nil {
		deps.UserZone = UTCUserZone{}
	}
	if deps.Now == nil {
		deps.Now = func() time.Time { return time.Now().UTC() }
	}
	if deps.NewID == nil {
		deps.NewID = platform.NewID
	}
	if deps.NewSeed == nil {
		deps.NewSeed = randomSeed
	}
	return &CommandService{
		launches:         deps.Launches,
		linker:           deps.Linker,
		progression:      deps.Progression,
		recalls:          deps.Recalls,
		spendGate:        deps.SpendGate,
		earn:             deps.Earn,
		achievements:     deps.Achievements,
		signupSettlement: deps.SignupSettlement,
		predictionError:  deps.PredictionError,
		viewSemantics:    deps.ViewSemantics,
		releases:         deps.Releases,
		sealSuggester:    deps.SealSuggester,
		userZone:         deps.UserZone,
		now:              deps.Now,
		newID:            deps.NewID,
		newSeed:          deps.NewSeed,
	}, nil
}
