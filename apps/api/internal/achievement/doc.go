// Package achievement is the supporting context for 업적 — the in-code catalog of achievements
// (one condition + one reward each), the counter store every condition is evaluated against, and
// the two non-derivable per-achievement facts: when a condition was first met and when its reward
// was received (ARCHITECTURE §2.2).
//
// Two structural guards shape every type here:
//
//   - No clock ([A1a]). AchievementServiceDeps carries no Now func and no time-typed field, no
//     file in this context calls time.Now, a Condition is exactly (counter key, integer target)
//     with no third field, and the store keeps aggregates, never events — achieved_at/claimed_at
//     are stamped by SQL now(). A streak, a per-day rate or a consecutive-login condition is
//     therefore unrepresentable, not merely forbidden.
//
//   - No reach into meaning ([A6][I11]). The context's only tables are its own two, it declares
//     no port into memory/twinkle/store/account, and no type here has a field for a memory id, a
//     strength, a mood identity, a position or any text — an achievement literally cannot name an
//     EpisodicMemory. Nor is 별자리 규모 a condition: that axis counts activations on ONE Neuron,
//     a stored fact, never an emergent structure ([I4]).
//
// It imports no other context. Withdrawal calls PurgeUser through a consumer-owned port; progress
// deltas arrive from producing contexts through the tracking use-case's recorder adapters, bound at the
// composition root.
package achievement
