# UX policy: signup

## Google is the only way in on web

The web entry screen accepts Google and nothing else. The email and password fields stay on screen,
disabled, under one line that says Google is the only way in for now — a visitor who came to type an
email is told why the field refuses them rather than left to hunt for one that is not there. The
credential path itself is intact behind a single flag in the entry page (`CREDENTIAL_ENTRY_ENABLED`),
so re-enabling it is a flag rather than a rebuilt form, and everything below still describes what
happens when it is on. Mobile is unchanged and still offers both.

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

## The entry screen is the origin root

On web, sign-in and signup are one screen, and it is what `/` renders: the empty sky, the brand mark
at full size, the mode's one sentence, and the credential panel under it. It stands on the same
ground the landing page does, and the continuity is the point — whichever of the two a visitor meets
first, the other must look like the same night. It is one screen with nothing below the fold: every
part of the choice fits the viewport, and a viewport too short to hold it grows rather than clipping
the submit.

Because a stranger now arrives here rather than on the landing, the screen carries two **side doors**
under the panel — the demo, and the page that says what this is (`/about`). Both take the quietest
shape the design system has — text, small, outside the card — and separate by colour rather than by
weight: the demo is `primary`, the explanation `secondary`. That order is the public-copy rule
applied here (demo before the ask, both times): a stranger has no reason to trust a form yet, and
the product's claim is that it only reads in motion. Neither is filled, so neither competes with the
way in, which is this screen's one ask.

Native has no marketing route and keeps its plain centred card — the same waiver that makes the
landing page web-only.

## Voice and parity

Public entry copy is quiet and factual: no therapeutic claim, brain analogy, decorative emoji, or
reward promise. Sign-in and signup navigate reciprocally, and both apps offer the same profile-gate
outcomes. Credential methods are the one deliberate divergence: web is Google-only while the flag
above is off, and mobile keeps both.
