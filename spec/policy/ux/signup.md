# UX policy: signup

## One question after credentials

Credential creation offers Google and email/password on both web and mobile. After authentication,
signup asks for exactly one product field: the nickname. The timezone is detected from the runtime
(`UTC` when unavailable) and the locale is the app's negotiated locale; neither is presented as a
question. Nickname length guidance is advisory, while the account service's refusal remains
authoritative.

## The nickname step is a gate

An authenticated session does not imply a complete product account. Before any product route,
palette read, or universe read mounts, the app-layer profile gate reads `GetProfile` and chooses one
of three outcomes:

- profile present — release the product subtree, unless the in-memory first-signin color handoff is
  waiting;
- profile absent — show the nickname step;
- read refused — show neutral retry and sign-out controls.

Profile absence is an unset response field, never inferred from an error string. The nickname step
is not a restorable wizard page: email confirmation or a later sign-in reaches the same gate from
the profile's absence.

## Color follows nickname, not credentials

After a successful first nickname write, both apps show one color screen before the universe. It is
separate from the nickname gate: nickname remains the only signup field. The screen presents the
thirteen moods together as thirteen real stars against the night sky, with three color
recommendations for the selected mood.

Choosing a recommendation updates and stores that mood immediately. The action "continue with
recommendations for the rest" is always reachable; it stores nothing for untouched moods, creates
no durable seen/skipped record, and enters the universe immediately.

Exposure rides the existing take-once in-memory signup-completion handoff, not absence of color
rows. The color gate consumes the handoff while visible and re-arms it when releasing the universe
so the first-signin tour still receives its original trigger.

## Invite entry

Invites bind through `<origin>/invite/<token>` on web or `cosimosi://invite/<token>` on mobile.
Entry capture removes the opaque token from the visible route and opens signup. The acknowledgment
says only that the visitor arrived through an invitation; it names no inviter and promises no
amount. An invalid, expired, self-referential, or withdrawn-inviter token is inert and never becomes
a branch that blocks profile creation.

The pending token survives the external Google round trip and the anonymous-to-user scope change.
It is consumed by the first `SignUp` request or cleared when an established profile enters.

## Voice and parity

Public entry copy is quiet and factual: no therapeutic claim, brain analogy, decorative emoji, or
reward promise. Sign-in and signup navigate reciprocally, and both apps offer the same two
credential methods and the same profile-gate outcomes.
