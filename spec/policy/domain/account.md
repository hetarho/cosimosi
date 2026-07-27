# Account domain policy

> As-built product rules for the `account` supporting context. Plans
> [60](../../plan/60.account-profile-model.md), [61](../../plan/61.signup-and-invite-usecase.md), and
> [62](../../plan/62.withdrawal-usecase.md) own this policy in build order.

## Authority split

- Supabase Auth is authoritative for credentials, email, email verification, and current provider membership.
- `users` is authoritative for nickname, timezone, locale, account creation time, and the withdrawal marker.
- Email is never copied into `users`; profile reads join the current directory value at the published behavior
  boundary.
- `platform.UserIdentity` carries only the authenticated Supabase subject. Product profile fields never enter the
  authentication scope.

## Profile rules

- A user may be authenticated but unprovisioned. An absent `users` row is represented by an absent profile message;
  reads never synthesize or lazily persist a profile.
- Nicknames are trimmed, non-unique, and measured in Unicode runes. The accepted inclusive range is
  `account.nickname_min_length` through `account.nickname_max_length`.
- A written timezone must resolve as an IANA location. A stored timezone that no longer resolves reads as `UTC`;
  the invalid stored value is not rewritten by the read.
- A profile update accepts only a shipped locale. It rejects an unknown locale because the update represents an
  explicit choice. Signup may instead coerce an unknown negotiated locale to the default.
- Locale precedence is stored `users.locale`, then the client’s persisted/device candidate, then the shipped
  default locale `en`.

## Day-boundary rule

`User.Timezone` is the single authority for truncating the real clock to “today”. It governs the `SMALL` reset,
the default diary date, the future-diary check, sync targets, and recall’s real-day baseline.

A timezone update writes only `users`. It never moves a grant window, balance, ledger entry, or universe clock.
Universe-time dates remain zone-free: elapsed-day, monotonic clock, forgetting, and semanticization math must not
gain a profile-zone dependency.

## Authentication-provider rules

- The closed product set is `GOOGLE | PASSWORD`.
- Supabase directory identities determine current membership; `auth_providers.linked_at` records when the product
  first observed the linkage.
- If the directory is unavailable, stored linkage rows are the degraded read fallback.
- Linkage is append-only in v2. There is no unlink behavior or contract.

## Invite-token rules

- An invite is carried by a link and is never typed as a code.
- The link token is a stateless HMAC-SHA256 capability over inviter id, issued-at, and a fresh nonce. It expires
  `account.invite_link_ttl_days` after the signed issued-at.
- A missing, short, or zero-value signing key fails closed; an unsigned or predictably keyed token is never issued.
- Verification authenticates the payload before trusting the inviter id, compares MACs in constant time, and
  rejects malformed, tampered, or expired tokens.
- Tokens are never looked up to discover an inviter. Bind-time uniqueness in `invites` makes a consumed token and an
  invitee binding single-use.

## Signup and invite-settlement rules

- `SignUp` is the only account provisioning mutation. It accepts nickname, client-detected timezone, negotiated
  locale, and an optional link token; it never accepts a provider claim, amount, or balance.
- Signup is once-born and idempotent. The first successful insert fixes the profile and its directory-observed
  initial provider; retries return that profile and neither overwrite it nor bind another invite.
- Every account RPC except `GetProfile` and `SignUp` requires an existing live profile. An authenticated user without
  a `users` row receives `ACCOUNT_SIGNUP_REQUIRED`.
- Invite binding is best-effort and happens only during first signup. Invalid, expired, self, consumed, or
  withdrawn-inviter links bind nothing and do not fail signup. An unavailable signing capability is an operational
  fault rather than an invalid invite: production refuses it at composition, and any reached binding surfaces the
  error so profile birth rolls back.
- Signup itself pays nothing. The one-time signup bonus and any two-sided invite reward settle only after a
  non-past-dated diary launches stars.
- An invite reward requires a distinct live inviter, the launched-star trigger, fewer than
  `twinkle.invite_reward_max_per_inviter` prior rewarded invites for that inviter, and a verified invitee email
  (`GOOGLE` linkage is implicitly verified).
- Credits are written before `invites.rewarded_at`. Ledger dedup keys
  `invite:<inviteID>`, `invite_signup:<inviteID>`, and `signup_bonus:<userID>` make replay and crash recovery
  exactly-once; settled rewards are never reversed.

## Withdrawal and restore rules

- `users.deleted_at` is the sole withdrawal marker and the source for the restore deadline. Both account withdrawal
  and diary release use `release.soft_delete_retention_days`; there is no account-specific retention value.
- `Withdraw` first schedules one deduplicated `withdrawal_sweep` job, then stamps real-clock UTC. A retry returns the
  original window and cannot extend it. A job left by a failed mark is inert because every sweep re-reads the marker.
- A withdrawn authenticated scope may call only `RestoreAccount`. The platform admission gate refuses every other
  registered procedure before its context handler runs, including `SignUp`, and includes the withdrawal and deadline
  timestamps in `PLATFORM_ACCOUNT_WITHDRAWN`.
- `RestoreAccount` clears the marker only before the deadline and then cancels the job. Cancellation failure is safe:
  the stale job sees a live account and no-ops. Restore writes no balance, reward, ownership, or achievement
  compensation.
- At the deadline, the scheduled worker purges only that user's product rows through owner-context legs. An invite
  owned by another inviter survives even when its `invitee_user_id` names the withdrawn user; counterpart rewards and
  operator rows also survive.
- Credentials remain usable during the restore window. The sweep bans the Supabase user immediately before deleting
  the credential, then deletes `users` last as its durable completion marker. Production refuses to compose this path
  without real Supabase Admin credentials and at least one named purge leg.
