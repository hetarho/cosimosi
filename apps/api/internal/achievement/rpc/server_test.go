package rpc

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/achievement"
	achievementpg "github.com/cosimosi/api/internal/achievement/pg"
	achievementv1 "github.com/cosimosi/api/internal/gen/cosimosi/achievement/v1"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
)

// The adapter's own tests: mapping in, mapping out, and the refusals. Nothing here exercises a
// decision — evaluation, ordering and reward resolution belong to the context behavior, and a test
// that could only be written by moving one out here would be a signal to fix the seam (§2.9 #7).

func newTestServer(t *testing.T) *Server {
	t.Helper()
	// A store over a nil handle: every path this file drives refuses before touching it.
	repo := achievementpg.NewStore(nil)
	service, err := achievement.NewService(achievement.AchievementServiceDeps{
		Repo:        repo,
		Twinkle:     unpayableGranter{},
		Ornaments:   unpayableGranter{},
		Settlements: unscheduledSettlements{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	server, err := NewServer(service)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}
	return server
}

type unpayableGranter struct{}

func (unpayableGranter) EarnAchievementReward(context.Context, platform.UserScope, string, int) (int, error) {
	return 0, errors.New("no ledger in an adapter test")
}

func (unpayableGranter) Grant(context.Context, platform.UserScope, string, string) error {
	return errors.New("no ornament catalog in an adapter test")
}

type unscheduledSettlements struct{}

func (unscheduledSettlements) ScheduleSettlement(
	context.Context,
	platform.UserScope,
	achievement.ClaimTx,
	string,
) error {
	return errors.New("no queue in an adapter test")
}

func TestNewServerRefusesAMissingService(t *testing.T) {
	t.Parallel()
	if _, err := NewServer(nil); !errors.Is(err, ErrServiceRequired) {
		t.Fatalf("NewServer(nil) err = %v, want ErrServiceRequired", err)
	}
}

func TestBothMethodsRefuseAnUnauthenticatedRequest(t *testing.T) {
	t.Parallel()
	server := newTestServer(t)
	ctx := context.Background()
	if _, err := server.ListAchievements(ctx, connect.NewRequest(&achievementv1.ListAchievementsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("ListAchievements code = %s, want unauthenticated", connect.CodeOf(err))
	}
	claim := connect.NewRequest(&achievementv1.ClaimAchievementRequest{AchievementId: "first_diary"})
	if _, err := server.ClaimAchievement(ctx, claim); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("ClaimAchievement code = %s, want unauthenticated", connect.CodeOf(err))
	}
	if _, err := userScope(ctx); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("userScope err = %v, want unauthenticated", err)
	}
}

// A blank id is the HANDLER's own refusal — an argument fault, answered before the service is
// reached, and distinct from the domain's "this id is not published".
func TestABlankAchievementIdIsRefusedAsAnArgumentFault(t *testing.T) {
	t.Parallel()
	scope, err := platform.NewUserScope("wire-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	ctx := platform.ContextWithUserID(context.Background(), scope.UserID())
	for _, id := range []string{"", "   "} {
		_, err := newTestServer(t).ClaimAchievement(
			ctx,
			connect.NewRequest(&achievementv1.ClaimAchievementRequest{AchievementId: id}),
		)
		info, ok := apperr.Info(err)
		if connect.CodeOf(err) != connect.CodeInvalidArgument || !ok || info.GetReason() != reasonInputRequired {
			t.Fatalf("claim(%q) = code %s info %#v, want invalid_argument/%s", id, connect.CodeOf(err), info, reasonInputRequired)
		}
	}
}

// Totality over the CATALOG, not over a hand-copied list. A tenth axis added to catalog.go without a
// proto arm would otherwise serialize as UNSPECIFIED and render under a heading no client can
// resolve — the FE groups by the wire value on purpose, so it cannot notice.
func TestEveryCatalogAxisHasAWireValue(t *testing.T) {
	t.Parallel()
	seen := map[achievement.Axis]struct{}{}
	for _, row := range achievement.Catalog() {
		if _, done := seen[row.Axis]; done {
			continue
		}
		seen[row.Axis] = struct{}{}
		if protoAxis(row.Axis) == achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_UNSPECIFIED {
			t.Errorf("axis %q has no wire value", row.Axis)
		}
	}
	if len(seen) == 0 {
		t.Fatal("the catalog published no axes, so this test asserted nothing")
	}
	// An axis outside the closed set maps to UNSPECIFIED rather than to a neighbouring one.
	if protoAxis(achievement.Axis("STREAK")) != achievementv1.AchievementAxis_ACHIEVEMENT_AXIS_UNSPECIFIED {
		t.Error("an axis outside the closed set was given a wire value")
	}
}

func TestDomainErrorClassifiesEverySentinelTheHandlerAnswers(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		err    error
		code   connect.Code
		reason string
	}{
		{"scope", achievement.ErrScopeRequired, connect.CodeUnauthenticated, reasonScopeRequired},
		{"unknown id", achievement.ErrUnknownAchievementID, connect.CodeNotFound, reasonNotFound},
		{"not achieved", achievement.ErrAchievementNotAchieved, connect.CodeFailedPrecondition, reasonNotAchieved},
		// The arm the whole recovery story rests on: the claim IS recorded and only the payout
		// failed, so the client is told to retry rather than that something broke — and it branches
		// on this reason to keep the row actionable.
		{"reward unavailable", achievement.ErrRewardUnavailable, connect.CodeUnavailable, reasonRewardUnavailable},
		// Wrapped, because the service always wraps: errors.Is has to see through it.
		{"wrapped reward unavailable", fmt.Errorf("credit diary_5: %w", achievement.ErrRewardUnavailable), connect.CodeUnavailable, reasonRewardUnavailable},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			err := domainError(testCase.err)
			info, ok := apperr.Info(err)
			if connect.CodeOf(err) != testCase.code || !ok || info.GetReason() != testCase.reason {
				t.Fatalf("domainError = code %s info %#v, want %s/%s", connect.CodeOf(err), info, testCase.code, testCase.reason)
			}
		})
	}

	// Everything the handler does NOT classify is internal — a wiring fault has no client-facing
	// reason, and inventing one would tell a user to retry something that cannot succeed.
	for _, unclassified := range []error{
		errors.New("database exploded"),
		achievement.ErrClaimIDRequired,
		achievement.ErrUnknownCounterKey,
	} {
		if code := connect.CodeOf(domainError(unclassified)); code != connect.CodeInternal {
			t.Errorf("domainError(%v) code = %s, want internal", unclassified, code)
		}
	}
}

// The memory.v1 string-time convention the proto's own field comment cites: RFC3339 UTC, and the
// empty string for the zero time rather than a year-1 timestamp no client can read.
func TestAchievedAtIsRFC3339UTCOrEmpty(t *testing.T) {
	t.Parallel()
	if wire := achievedAtWire(time.Time{}); wire != "" {
		t.Errorf("zero achieved_at = %q, want empty", wire)
	}
	// A non-UTC zone in, UTC out: the field's contract is UTC, not the server's locale.
	seoul := time.Date(2026, 7, 1, 12, 30, 0, 0, time.FixedZone("KST", 9*60*60))
	if wire := achievedAtWire(seoul); wire != "2026-07-01T03:30:00Z" {
		t.Errorf("achieved_at = %q, want the UTC RFC3339 rendering", wire)
	}
}

// One currency, one width. The read and the claim response carry the reward as the same wire type as
// every other Twinkle quantity (twinkle.v1's balances, costs and ledger amounts), so a client never
// reads the same number two ways.
func TestTheRewardCrossesTheWireAtOneWidth(t *testing.T) {
	t.Parallel()
	entryField := (&achievementv1.AchievementEntry{}).ProtoReflect().Descriptor().Fields().ByName("reward_twinkle")
	claimField := (&achievementv1.ClaimAchievementResponse{}).ProtoReflect().Descriptor().Fields().ByName("granted_twinkle")
	if entryField == nil || claimField == nil {
		t.Fatal("the reward fields are not on the contract")
	}
	if entryField.Kind() != claimField.Kind() {
		t.Fatalf("reward_twinkle is %s but granted_twinkle is %s", entryField.Kind(), claimField.Kind())
	}
}
