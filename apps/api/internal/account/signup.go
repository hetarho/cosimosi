package account

import (
	"context"
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

const defaultLocale = "en"

type signupSettlementContextKey struct{}

func withSignupSettlement(ctx context.Context) context.Context {
	return context.WithValue(ctx, signupSettlementContextKey{}, true)
}

func isSignupSettlement(ctx context.Context) bool {
	authorized, _ := ctx.Value(signupSettlementContextKey{}).(bool)
	return authorized
}

// SignUp performs the account's once-ever first write. It deliberately exposes no economy
// dependency: profile birth and optional link binding cannot credit anything.
func (s *Service) SignUp(
	ctx context.Context,
	scope platform.UserScope,
	input SignUpInput,
) (Profile, bool, error) {
	if scope.UserID() == "" {
		return Profile{}, false, ErrScopeRequired
	}
	normalized, err := normalizeSignUpInput(input)
	if err != nil {
		return Profile{}, false, err
	}

	// Provider membership is directory-owned. A failed lookup is degraded-but-valid signup;
	// ListAuthProviders later reconciles the missing append-only observation.
	provider := s.initialAuthProvider(ctx, scope.UserID())
	var (
		profile Profile
		created bool
		bound   bool
	)
	err = s.store.InSignupTx(ctx, func(store Store) error {
		var txErr error
		profile, created, txErr = store.CreateUserIfAbsent(ctx, scope, normalized, provider)
		if txErr != nil {
			return txErr
		}
		profile = normalizeStoredProfile(profile)
		if !created || normalized.InviteToken == "" {
			return nil
		}
		bound, txErr = s.acceptInvite(ctx, store, scope, normalized.InviteToken)
		return txErr
	})
	if err != nil {
		return Profile{}, false, err
	}
	return profile, bound, nil
}

func normalizeSignUpInput(input SignUpInput) (SignUpInput, error) {
	nickname, err := normalizeNickname(input.Nickname)
	if err != nil {
		return SignUpInput{}, err
	}
	input.Nickname = nickname

	input.Timezone = strings.TrimSpace(input.Timezone)
	if input.Timezone == "" || !resolvesTimezone(input.Timezone) {
		return SignUpInput{}, ErrTimezoneInvalid
	}

	input.Locale = strings.TrimSpace(input.Locale)
	if !knownLocale(input.Locale) {
		// Signup receives a negotiated guess rather than an explicit preference edit, so an
		// off-set/empty tag safely falls back instead of lying about a rejected user choice.
		input.Locale = defaultLocale
	}
	input.InviteToken = strings.TrimSpace(input.InviteToken)
	return input, nil
}

func normalizeNickname(value string) (string, error) {
	value = strings.TrimSpace(value)
	length := utf8.RuneCountInString(value)
	if length < values.AccountNicknameMinLength || length > values.AccountNicknameMaxLength {
		return "", ErrNicknameInvalid
	}
	for _, r := range value {
		if unicode.IsControl(r) || unicode.Is(unicode.Zl, r) || unicode.Is(unicode.Zp, r) {
			return "", ErrNicknameInvalid
		}
	}
	return value, nil
}

func (s *Service) initialAuthProvider(ctx context.Context, userID string) *AuthProvider {
	identities, err := s.directory.Identities(ctx, userID)
	if err != nil {
		return nil
	}
	for _, identity := range identities {
		kind, ok := providerKindForIdentity(identity)
		if !ok {
			continue
		}
		// Supabase's product account id is the stable linkage identity available through the
		// intentionally narrow directory port; the provider kind itself came from the directory.
		return &AuthProvider{Kind: kind, ProviderUserID: userID}
	}
	return nil
}

// AcceptInvite binds a verified link during first signup only. Expected capability refusals are
// best-effort outcomes; persistence failures still surface so infrastructure faults are visible.
func (s *Service) AcceptInvite(ctx context.Context, inviteeScope platform.UserScope, token string) (bool, error) {
	return s.acceptInvite(ctx, s.store, inviteeScope, token)
}

func (s *Service) acceptInvite(
	ctx context.Context,
	store Store,
	inviteeScope platform.UserScope,
	token string,
) (bool, error) {
	if inviteeScope.UserID() == "" {
		return false, ErrScopeRequired
	}
	verified, err := s.VerifyInviteToken(strings.TrimSpace(token))
	if err != nil {
		return false, nil
	}
	if verified.InviterUserID == inviteeScope.UserID() {
		return false, nil
	}
	return store.BindInviteToInvitee(ctx, inviteeScope, Invite{
		ID:            s.newID(),
		InviterUserID: verified.InviterUserID,
		InviteeUserID: inviteeScope.UserID(),
		Token:         verified.Token,
		CreatedAt:     verified.IssuedAt,
		BoundAt:       s.now().UTC(),
	})
}

// ResolveInviteSettlement is the trusted [G6] conjunction consumed by Twinkle. The launched-
// engram condition is structural: this behavior is reachable in production only from the
// post-commit launch hook, never from a wire handler.
func (s *Service) ResolveInviteSettlement(
	ctx context.Context,
	request InviteSettlementRequest,
) (SettledInvite, error) {
	if !isSignupSettlement(ctx) {
		return SettledInvite{}, ErrInviteNotEligible
	}
	inviteeScope, err := platform.NewUserScope(strings.TrimSpace(request.InviteeUserID))
	if err != nil || strings.TrimSpace(request.Token) == "" {
		return SettledInvite{}, ErrInviteNotEligible
	}

	// 1. The relationship read also establishes distinctness and current inviter liveness.
	invite, err := s.store.FindSettleableInviteForInvitee(ctx, inviteeScope)
	if err != nil {
		return SettledInvite{}, err
	}
	if invite == nil || invite.Token != request.Token {
		return SettledInvite{}, ErrInviteNotEligible
	}

	// 2. At least one launched EpisodicMemory is guaranteed by the only production caller. A
	// Diary count would be weaker because a past-dated diary can exist without launching an engram.

	// 3. Apply the lifetime cap before any external directory call.
	inviterScope, err := platform.NewUserScope(invite.InviterUserID)
	if err != nil {
		return SettledInvite{}, ErrInviteNotEligible
	}
	rewarded, err := s.store.CountRewardedInvitesByInviter(ctx, inviterScope)
	if err != nil {
		return SettledInvite{}, err
	}
	if rewarded >= int64(values.TwinkleInviteRewardMaxPerInviter) {
		return SettledInvite{}, ErrInviteNotEligible
	}

	// 4. Google linkage implies a verified address; otherwise Supabase's confirmation timestamp
	// is authoritative. Directory failure stays retryable because rewarded_at remains NULL.
	providers, err := s.store.ListAuthProviders(ctx, inviteeScope)
	if err != nil {
		return SettledInvite{}, err
	}
	verifiedEmail := false
	for _, provider := range providers {
		if provider.Kind == AuthProviderGoogle {
			verifiedEmail = true
			break
		}
	}
	if !verifiedEmail {
		verifiedAt, directoryErr := s.directory.EmailVerifiedAt(ctx, inviteeScope.UserID())
		if directoryErr != nil {
			return SettledInvite{}, directoryErr
		}
		verifiedEmail = !verifiedAt.IsZero()
	}
	if !verifiedEmail {
		return SettledInvite{}, ErrInviteNotEligible
	}

	return SettledInvite{
		InviteID:      invite.InviteID,
		InviterUserID: invite.InviterUserID,
		InviteeUserID: invite.InviteeUserID,
	}, nil
}

// SettleSignup pairs account bookkeeping with independently idempotent Twinkle credits. Credits
// land before rewarded_at so a crash can only replay dedup-keyed no-ops, never lose a reward.
func (s *Service) SettleSignup(ctx context.Context, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return err
	}
	invite, err := s.store.FindSettleableInviteForInvitee(ctx, scope)
	settlementErr := err
	if err == nil && invite != nil {
		inviterScope, scopeErr := platform.NewUserScope(invite.InviterUserID)
		if scopeErr != nil {
			settlementErr = ErrInviteNotEligible
		} else {
			settlementErr = s.store.WithInviteSettlementLock(ctx, inviterScope, func() error {
				// Re-resolve under the inviter lock: concurrent invitees cannot all observe the
				// same pre-cap count. The private context marker also makes the resolver
				// unreachable from the legacy ClaimInvite wire method.
				grantErr := s.inviteGranter.Grant(withSignupSettlement(ctx), scope, invite.Token)
				if grantErr != nil {
					if errors.Is(grantErr, ErrInviteNotEligible) {
						return nil
					}
					return grantErr
				}
				return s.store.MarkInviteRewarded(ctx, inviterScope, invite.InviteID, s.now().UTC())
			})
		}
	}

	// The one-time signup bonus is independent of invite eligibility and is attempted after every
	// admitted launch. Its account-scoped dedup key makes the steady-state call a no-op.
	bonusErr := s.signupBonusGranter.Grant(ctx, scope)
	return errors.Join(settlementErr, bonusErr)
}
