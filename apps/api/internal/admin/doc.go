// Package admin is the operator-console bounded context (the admin console): the authorization rule and
// use-cases behind the web-only /admin surface. It is a distinct core context that orchestrates
// ACROSS the others — accounts, the Twinkle economy, memory stats, AI provider config, metering,
// and the job queue — strictly through consumer-owned ports wired at the composition root. It
// imports NO other context's internals (the twinkle-never-imports-memory rule, CC8).
//
// Two invariants shape it. Privacy ([I2]): the console is metadata-only — no port or use-case
// here reads a user's diary text, emotion, episodic memory meaning, or position; the MemoryStats port returns
// counts, never content. Authorization: every use-case is reachable only by an admin — the
// env-seed ADMIN_USER_IDS set (the undemotable trust anchor) unioned with the DB-promoted
// admin_users rows — enforced by the admin-authorization interceptor (rpc/authz.go) that fronts
// every admin.v1 method. Admin reads are the one sanctioned cross-user surface (§4), gated by that
// authorization rather than by per-user scoping.
package admin
