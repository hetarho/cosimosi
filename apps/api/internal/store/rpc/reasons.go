package rpc

const (
	reasonScopeRequired = "STORE_SCOPE_REQUIRED"
	// reasonInsufficientTwinkle is distinct from TWINKLE_INSUFFICIENT deliberately: this one's copy
	// says that the whole save was refused, and it carries the item the balance ran out on.
	reasonInsufficientTwinkle = "STORE_INSUFFICIENT_TWINKLE"
	reasonOrnamentUnknown     = "STORE_ORNAMENT_UNKNOWN"
	// reasonOrnamentNotPurchasable answers a save containing an unowned achievement-only ornament: it
	// is not expensive, it is not for sale.
	reasonOrnamentNotPurchasable = "STORE_ORNAMENT_NOT_PURCHASABLE"
)
