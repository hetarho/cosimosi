package account

import (
	"context"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

// Store is the account context's consumer-owned persistence port. The concrete lives in
// account/pg, and no sqlc type crosses this boundary.
type Store interface {
	InSignupTx(ctx context.Context, fn func(Store) error) error
	WithInviteSettlementLock(ctx context.Context, inviterScope platform.UserScope, fn func() error) error
	ListMoodColors(ctx context.Context, scope platform.UserScope) ([]MoodColor, error)
	SetMoodColor(ctx context.Context, scope platform.UserScope, color MoodColor, bucket int32) (MoodColor, error)
	ListMoodColorStats(ctx context.Context, mood Mood, recommendationCount int32) ([]MoodColorStatCount, error)
	GetUserProfile(ctx context.Context, scope platform.UserScope) (profile Profile, found bool, err error)
	// UserTimezones answers the stored zone of many users in ONE read, backing the batch ZonesFor
	// the admin list enriches through. Rows absent from the result carry no stored zone; the
	// service owns their default. Cross-user by shape, so it takes ids rather than a scope: the
	// only caller is the authorized admin surface, reached through admin's own port.
	UserTimezones(ctx context.Context, userIDs []string) (map[string]string, error)
	CreateUserIfAbsent(ctx context.Context, scope platform.UserScope, input SignUpInput, provider *AuthProvider) (profile Profile, created bool, err error)
	UpdateUserProfile(ctx context.Context, scope platform.UserScope, input UpdateProfileInput) (profile Profile, found bool, err error)
	ListAuthProviders(ctx context.Context, scope platform.UserScope) ([]AuthProvider, error)
	RecordAuthProvider(ctx context.Context, scope platform.UserScope, kind AuthProviderKind, providerUserID string) error
	BindInviteToInvitee(ctx context.Context, inviteeScope platform.UserScope, invite Invite) (bool, error)
	FindSettleableInviteForInvitee(ctx context.Context, inviteeScope platform.UserScope) (*SettleableInvite, error)
	CountRewardedInvitesByInviter(ctx context.Context, scope platform.UserScope) (int64, error)
	MarkInviteRewarded(ctx context.Context, inviterScope platform.UserScope, inviteID string, rewardedAt time.Time) error
}

// Directory is account's narrow view of Supabase Auth. The composition root translates from the
// platform adapter, so this context imports no external SDK or platform DTO.
type Directory interface {
	EmailFor(ctx context.Context, userID string) (string, error)
	EmailVerifiedAt(ctx context.Context, userID string) (time.Time, error)
	Identities(ctx context.Context, userID string) ([]string, error)
}

// InviteSigner computes the keyed MAC used by stateless invite capabilities. Verification
// recomputes the MAC through this same port and compares it in constant time in account behavior.
type InviteSigner interface {
	MAC(payload []byte) ([]byte, error)
}

// InviteRewardGranter is account's consumer-owned view of the paired invite credit. The token
// is opaque at this edge; only the authenticated invitee scope accompanies it.
type InviteRewardGranter interface {
	Grant(ctx context.Context, scope platform.UserScope, token string) error
}

// SignupBonusGranter is the one-time onboarding credit seam. No amount is expressible here.
type SignupBonusGranter interface {
	Grant(ctx context.Context, scope platform.UserScope) error
}

// WithdrawalStore owns users.deleted_at and the account context's purge statements.
// InWithdrawalTx serializes restore and sweep on the User row while every foreign-context
// purge still commits in its own transaction.
type WithdrawalStore interface {
	InWithdrawalTx(ctx context.Context, fn func(WithdrawalStore) error) error
	WithdrawalStatus(ctx context.Context, scope platform.UserScope) (withdrawnAt time.Time, found bool, err error)
	WithdrawalStatusForUpdate(ctx context.Context, scope platform.UserScope) (withdrawnAt time.Time, found bool, err error)
	MarkWithdrawn(ctx context.Context, scope platform.UserScope, withdrawnAt time.Time) (time.Time, bool, error)
	ClearWithdrawal(ctx context.Context, scope platform.UserScope, withdrawnAt time.Time) (bool, error)
	PurgeAccountDependents(ctx context.Context, scope platform.UserScope) error
	PurgeAccountUser(ctx context.Context, scope platform.UserScope) (bool, error)
}

// UserDataPurger is one owning context's idempotent, per-user purge leg.
type UserDataPurger interface {
	PurgeName() string
	PurgeUser(ctx context.Context, scope platform.UserScope) error
}

// WithdrawalSweepScheduler is account's narrow view of memory's durable user-job seam.
type WithdrawalSweepScheduler interface {
	Schedule(ctx context.Context, scope platform.UserScope, dueAt time.Time) error
	Cancel(ctx context.Context, scope platform.UserScope) error
}

// CredentialDirectory is the only identity mutation surface account withdrawal consumes.
type CredentialDirectory interface {
	SetUserBanned(ctx context.Context, userID string, banned bool) error
	DeleteUser(ctx context.Context, userID string) error
}

// AchievementRecorder is account's consumer-owned progress-report seam ([A6][I11]): a key and a
// delta, and no field in which an account fact could travel. The transaction handle is `any` —
// account's invite settlement runs as a locked sequence of statements rather than one transaction,
// so the concrete adapter binds a pool-bound store; the parameter exists so the port matches the
// producer shape the other contexts use.
type AchievementRecorder interface {
	RecordProgress(ctx context.Context, scope platform.UserScope, tx any, counterKey string, delta int) error
}

// NoAchievementRecorder is the achievement-less binding: a settled invite counts nothing. Production
// binds the real recorder — cmd/api refuses to boot without it.
type NoAchievementRecorder struct{}

func (NoAchievementRecorder) RecordProgress(
	context.Context,
	platform.UserScope,
	any,
	string,
	int,
) error {
	return nil
}

// CounterInviteSettled counts a settled valid signup under the INVITER's scope — the [A2] axis is
// "친구 초대 성공", an inviter fact, so the invitee gets no counter. Its spelling and mode belong to
// the achievement catalog; the composition root reconciles this set against the keys the catalog
// reads and refuses to boot on a difference.
const CounterInviteSettled = "invite_settled"

// AchievementCounterKeys is every key this context can emit.
func AchievementCounterKeys() []string {
	return []string{CounterInviteSettled}
}
