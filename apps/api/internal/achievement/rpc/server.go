// Package rpc is the achievement context's transport adapter: a thin Connect handler that maps
// domain entries to proto DTOs and calls the read (ARCHITECTURE §2.7/§2.9#7). No catalog logic
// lives here — evaluation, ordering and reward resolution all belong to the context behavior.
package rpc

import (
	"context"
	"errors"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/achievement"
	achievementv1 "github.com/cosimosi/api/internal/gen/cosimosi/achievement/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
)

var (
	ErrServiceRequired = errors.New("achievement rpc server requires the achievement service")
	// errClaimInputRequired is the handler's own refusal of a blank id — an argument fault, distinct
	// from the domain's "this id is not published".
	errClaimInputRequired = errors.New("claim requires an achievement id")
)

type Server struct {
	service *achievement.Service
}

func NewServer(service *achievement.Service) (*Server, error) {
	if service == nil {
		return nil, ErrServiceRequired
	}
	return &Server{service: service}, nil
}

func (s *Server) ListAchievements(
	ctx context.Context,
	_ *connect.Request[achievementv1.ListAchievementsRequest],
) (*connect.Response[achievementv1.ListAchievementsResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	entries, err := s.service.ListAchievements(ctx, scope)
	if err != nil {
		return nil, domainError(err)
	}
	dto := make([]*achievementv1.AchievementEntry, 0, len(entries))
	for _, entry := range entries {
		achievedAt := ""
		if !entry.AchievedAt.IsZero() {
			achievedAt = entry.AchievedAt.UTC().Format(time.RFC3339)
		}
		dto = append(dto, &achievementv1.AchievementEntry{
			AchievementId:    entry.ID,
			Axis:             protoAxis(entry.Axis),
			Target:           entry.Condition.Target,
			Progress:         entry.Progress,
			RewardTwinkle:    int32(entry.Reward.Twinkle()),
			RewardOrnamentId: entry.Reward.OrnamentID,
			Achieved:         entry.Achieved,
			Claimed:          entry.Claimed,
			AchievedAt:       achievedAt,
		})
	}
	return connect.NewResponse(&achievementv1.ListAchievementsResponse{Entries: dto}), nil
}

// ClaimAchievement is thin: map the id in, call the use-case, map the result and the refusals out.
// The atomicity, the replay behavior and which leg pays all belong to the use-case (§2.9 #7).
func (s *Server) ClaimAchievement(
	ctx context.Context,
	req *connect.Request[achievementv1.ClaimAchievementRequest],
) (*connect.Response[achievementv1.ClaimAchievementResponse], error) {
	scope, err := userScope(ctx)
	if err != nil {
		return nil, err
	}
	achievementID := strings.TrimSpace(req.Msg.GetAchievementId())
	if achievementID == "" {
		return nil, apperr.Domain(connect.CodeInvalidArgument, reasonInputRequired, errClaimInputRequired, nil)
	}
	result, err := s.service.ClaimAchievement(ctx, scope, achievementID)
	if err != nil {
		return nil, domainError(err)
	}
	return connect.NewResponse(&achievementv1.ClaimAchievementResponse{
		GrantedTwinkle:    int64(result.TwinkleAmount),
		GrantedOrnamentId: result.OrnamentID,
		TwinkleTotal:      int64(result.TwinkleTotal),
	}), nil
}

func userScope(ctx context.Context) (platform.UserScope, error) {
	scope, err := platform.UserScopeFromContext(ctx)
	if err != nil {
		return platform.UserScope{}, apperr.Domain(connect.CodeUnauthenticated, apperr.ReasonPlatformUnauthenticated, err, nil)
	}
	return scope, nil
}

func protoAxis(axis achievement.Axis) achievementv1.AchievementAxis {
	switch axis {
	case achievement.AxisFirstExperience:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_FIRST_EXPERIENCE
	case achievement.AxisDiaryTotal:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_DIARY_TOTAL
	case achievement.AxisStarTotal:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_STAR_TOTAL
	case achievement.AxisRecallTotal:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_RECALL_TOTAL
	case achievement.AxisGistDepth:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_GIST_DEPTH
	case achievement.AxisForgettingRecovery:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_FORGETTING_RECOVERY
	case achievement.AxisNeuronSharing:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_NEURON_SHARING
	case achievement.AxisMoodVariety:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_MOOD_VARIETY
	case achievement.AxisDecoration:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_DECORATION
	default:
		return achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_UNSPECIFIED
	}
}

// domainError maps the context's canonical errors onto Connect codes. A granter failure is
// deliberately its own reason rather than an internal error: the claim IS recorded, and the next
// attempt replays it — the client should be told to retry, not that something broke.
func domainError(err error) error {
	switch {
	case errors.Is(err, achievement.ErrScopeRequired):
		return apperr.Domain(connect.CodeUnauthenticated, reasonScopeRequired, err, nil)
	case errors.Is(err, achievement.ErrUnknownAchievementID):
		return apperr.Domain(connect.CodeNotFound, reasonNotFound, err, nil)
	case errors.Is(err, achievement.ErrAchievementNotAchieved):
		return apperr.Domain(connect.CodeFailedPrecondition, reasonNotAchieved, err, nil)
	case errors.Is(err, achievement.ErrRewardUnavailable):
		return apperr.Domain(connect.CodeUnavailable, reasonRewardUnavailable, err, nil)
	default:
		return apperr.Internal(err)
	}
}
