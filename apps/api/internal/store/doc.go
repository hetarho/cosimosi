// Package store is the supporting context for 우주 꾸미기 — the decoration catalog, what a user
// owns of it, and what their universe wears right now (ARCHITECTURE §2.2).
//
// One invariant shapes every type here: an ornament sells a RENDER-PARAMETER ID and nothing else.
// No type in this package, no column in its two tables, and no field in its proto has anywhere to
// put a color, size, brightness, seed, position or free-form parameter payload, so a purchase that
// changed what a memory MEANS is not something a reviewer has to catch — it cannot be written
// ([V10][I11]). What an ornament looks like lives in the renderer's registries; this context holds
// only the opaque ids they publish and never learns what they resolve to.
//
// It imports no other context. Withdrawal calls PurgeUser through a consumer-owned port; the
// achievement reward and the purchase transaction reach it the same way, from the composition root.
package store
