package account

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

const (
	inviteSigningKeyBytes = 32
	inviteNonceBytes      = 32
)

type HMACInviteSigner struct {
	key []byte
}

func NewHMACInviteSigner(key []byte) (HMACInviteSigner, error) {
	if len(key) < inviteSigningKeyBytes {
		return HMACInviteSigner{}, ErrInviteLinkUnavailable
	}
	return HMACInviteSigner{key: append([]byte(nil), key...)}, nil
}

func (s HMACInviteSigner) MAC(payload []byte) ([]byte, error) {
	if len(s.key) < inviteSigningKeyBytes {
		return nil, ErrInviteLinkUnavailable
	}
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write(payload)
	return mac.Sum(nil), nil
}

type UnavailableInviteSigner struct{}

func (UnavailableInviteSigner) MAC([]byte) ([]byte, error) {
	return nil, ErrInviteLinkUnavailable
}

func (s *Service) GetInviteLink(ctx context.Context, scope platform.UserScope) (InviteLink, error) {
	if err := ctx.Err(); err != nil {
		return InviteLink{}, err
	}
	if scope.UserID() == "" {
		return InviteLink{}, ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return InviteLink{}, err
	}
	issuedAt := s.now().UTC().Truncate(time.Second)
	nonce := make([]byte, inviteNonceBytes)
	if _, err := rand.Read(nonce); err != nil {
		return InviteLink{}, err
	}
	encoding := base64.RawURLEncoding
	payload := strings.Join([]string{
		encoding.EncodeToString([]byte(scope.UserID())),
		encoding.EncodeToString([]byte(strconv.FormatInt(issuedAt.Unix(), 10))),
		encoding.EncodeToString(nonce),
	}, ".")
	mac, err := s.inviteSigner.MAC([]byte(payload))
	if err != nil {
		return InviteLink{}, err
	}
	expiresAt := issuedAt.Add(time.Duration(values.AccountInviteLinkTtlDays) * 24 * time.Hour)
	return InviteLink{Token: payload + "." + encoding.EncodeToString(mac), ExpiresAt: expiresAt}, nil
}

func (s *Service) VerifyInviteToken(token string) (VerifiedInviteToken, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 4 {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	payload := strings.Join(parts[:3], ".")
	presentedMAC, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	expectedMAC, err := s.inviteSigner.MAC([]byte(payload))
	if err != nil {
		return VerifiedInviteToken{}, err
	}
	if !hmac.Equal(presentedMAC, expectedMAC) {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}

	inviterBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || len(inviterBytes) == 0 {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	issuedBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	issuedUnix, err := strconv.ParseInt(string(issuedBytes), 10, 64)
	if err != nil {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	nonce, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(nonce) != inviteNonceBytes {
		return VerifiedInviteToken{}, ErrInviteTokenInvalid
	}
	issuedAt := time.Unix(issuedUnix, 0).UTC()
	expiresAt := issuedAt.Add(time.Duration(values.AccountInviteLinkTtlDays) * 24 * time.Hour)
	if s.now().UTC().After(expiresAt) {
		return VerifiedInviteToken{}, ErrInviteTokenExpired
	}
	return VerifiedInviteToken{
		InviterUserID: string(inviterBytes),
		IssuedAt:      issuedAt,
		Token:         token,
	}, nil
}
