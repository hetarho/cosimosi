package admin

import "errors"

var (
	// ErrStoreRequired etc. are composition faults — a missing dependency at construction.
	ErrStoreRequired     = errors.New("admin service requires a persistence store")
	ErrDirectoryRequired = errors.New("admin service requires an account directory")
	ErrStardustRequired  = errors.New("admin service requires a stardust granter")
	ErrMemoryStats       = errors.New("admin service requires a memory stats reader")
	ErrUsageRequired     = errors.New("admin service requires an AI usage reader")
	ErrJobsRequired      = errors.New("admin service requires a job health reader")
	ErrCipherRequired    = errors.New("admin service requires an API-key cipher")
	ErrValidatorRequired = errors.New("admin service requires an AI provider validator")

	// ErrUserIDRequired rejects an admin action with no target user id.
	ErrUserIDRequired = errors.New("admin action requires a target user id")
	// ErrSeedAdminUndemotable refuses a RevokeAdmin against an env-seed admin — the
	// ADMIN_USER_IDS set is the trust anchor and can only change via env + redeploy.
	ErrSeedAdminUndemotable = errors.New("seed admin cannot be demoted from the console")
	// ErrGrantAmountRange rejects a grant outside (0, twinkle.admin_grant_max].
	ErrGrantAmountRange = errors.New("stardust grant amount is out of range")
	// ErrGrantIDRequired rejects a grant without a client idempotency id.
	ErrGrantIDRequired = errors.New("stardust grant requires a grant id")
	// ErrUnknownCapability rejects an AI capability outside {llm, embedding}.
	ErrUnknownCapability = errors.New("unknown AI capability")
	// ErrProviderRequired rejects a SetAIConfig with no provider.
	ErrProviderRequired = errors.New("AI config requires a provider")
)
