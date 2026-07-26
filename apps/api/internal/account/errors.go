package account

import "errors"

var (
	ErrScopeRequired         = errors.New("account behavior requires authenticated user scope")
	ErrStoreRequired         = errors.New("account service requires a store")
	ErrDirectoryRequired     = errors.New("account service requires an account directory")
	ErrNotProvisioned        = errors.New("account profile is not provisioned")
	ErrNicknameInvalid       = errors.New("account nickname is invalid")
	ErrTimezoneInvalid       = errors.New("account timezone is invalid")
	ErrLocaleInvalid         = errors.New("account locale is invalid")
	ErrUnknownPaletteID      = errors.New("palette id is not a known registry palette")
	ErrAuthProviderInvalid   = errors.New("account auth provider is invalid")
	ErrInviteLinkUnavailable = errors.New("account invite link is unavailable")
	ErrInviteTokenInvalid    = errors.New("account invite token is invalid")
	ErrInviteTokenExpired    = errors.New("account invite token is expired")
)
