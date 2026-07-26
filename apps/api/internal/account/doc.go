// Package account is the supporting context for a user's product profile, authentication-provider
// linkage, invite capabilities, and presentation preferences (ARCHITECTURE §2.2).
//
// Supabase Auth remains authoritative for credentials, email, verification, and provider
// membership. Account owns nickname, timezone, locale, linkage timestamps, and invite bindings.
// Its published ZoneFor behavior is the sole source of the real-clock day boundary consumed by
// other contexts; those consumers never read account tables directly.
package account
