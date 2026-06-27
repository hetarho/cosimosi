// Package platform owns transport-only infrastructure: the net/http composition root,
// Connect unary handlers, CORS, request IDs, logging, panic recovery, and the auth seam.
//
// Read RPCs that are safe to cache must be unary methods marked with
// idempotency_level = NO_SIDE_EFFECTS in proto; Connect clients then opt into HTTP GET.
// Mutating RPCs stay POST. Server streaming, websockets, subscriptions, and business
// policy do not belong in this package.
package platform
