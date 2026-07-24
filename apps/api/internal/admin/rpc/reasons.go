package rpc

const (
	reasonForbidden                  = "ADMIN_FORBIDDEN"
	reasonSeedAdminUndemotable       = "ADMIN_SEED_ADMIN_UNDEMOTABLE"
	reasonUserIDRequired             = "ADMIN_USER_ID_REQUIRED"
	reasonGrantAmountRange           = "ADMIN_GRANT_AMOUNT_RANGE"
	reasonGrantIDRequired            = "ADMIN_GRANT_ID_REQUIRED"
	reasonUnknownCapability          = "ADMIN_UNKNOWN_CAPABILITY"
	reasonProviderRequired           = "ADMIN_PROVIDER_REQUIRED"
	reasonProviderKeyRequired        = "ADMIN_PROVIDER_KEY_REQUIRED"
	reasonUnknownProvider            = "ADMIN_UNKNOWN_PROVIDER"
	reasonProviderCapabilityMismatch = "ADMIN_PROVIDER_CAPABILITY_MISMATCH"
	reasonProviderNotImplemented     = "ADMIN_PROVIDER_NOT_IMPLEMENTED"
	reasonProviderKeyMissing         = "ADMIN_PROVIDER_KEY_MISSING"
	reasonSecretboxDisabled          = "ADMIN_SECRETBOX_DISABLED"
)
