// Package account is a supporting context for per-user account preferences (ARCHITECTURE §2.2).
// Today it owns exactly one preference — the chosen emotion-palette id — behind a small get/set
// behavior, integrated only through that published behavior and never by another context reaching
// into its table.
//
// It computes no color. The palette id is an opaque first-party key it validates against the
// registry allow-list; the color table the id selects lives entirely on the client. This keeps
// the preference structurally unable to reach the meaning layer: the only value it stores is a
// scalar id, never a mood, coordinate, position, or strength.
package account
