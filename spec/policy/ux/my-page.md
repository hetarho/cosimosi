# UX policy: my page

## One signed-in account home

My page is the sole signed-in account surface: web `/me` and mobile `Me`, reached from the
universe. It has exactly five tabs in this order: profile, feeling colors, stardust, achievements,
and diary management. Web keeps the active tab in the `tab` query parameter so links and
reloads preserve it; mobile keeps it as local screen state. Missing or unknown web values show
profile — which is also what a link to the retired `?tab=account` now lands on, and where its rows are.

**There is no 계정 tab.** The signed-in identity, the linked ways in, sign-out and withdrawal are facts
about the same person the profile tab is already about, and splitting them across two tabs made a reader
hunt for their own email in the tab that does not say 프로필. They sit at the **foot** of the profile,
last and behind a separating rule: signing out and leaving are the two things here a stray press must
not reach, so distance is what protects them ([U9]).

## The header names the open tab, and the way out leads

The way back to the universe sits at the **left** end of the header and the title is **centred** on the
line, naming the **open tab** rather than the account home in general. With the tab strip directly
beneath it, a fixed 나 said nothing the strip did not already say, while the open tab's name is the one
fact the header can add about where the reader is. The same three-part header is the diary reader's
([47]), so leaving any supporting surface is the same gesture in the same corner — down to the control
itself, which wears the product-wide back form: a bare left arrow and its destination, no fill and no
rim (design-language §6).

The feeling-colors tab is the emotion-color editor and owns the whole surface, rather than sharing a
row of the profile tab. At rest it shows only what the thirteen moods currently wear: one swatch and
one label each, and nothing to choose. Choosing happens one mood at a time on the surface that
interrupts (`Dialog` — centred modal on a wide screen, bottom sheet on a narrow one).

No other decoration lives here. My page offers no background, shader, camera, or effect control,
and the color editor cannot reach a star's meaning, brightness, position, or connections.

## Profile facts are edited one at a time

Nickname, language, and timezone are separate rows with separate actions. Nickname guidance uses
the configured account limits while the server remains authoritative. Choosing a language changes
the app immediately, persists the complete profile to the server, and rolls the language back with
an error when persistence fails. Web also keeps the explicit choice locally; mobile relies on the
signed-in server preference and otherwise returns to the device locale.

Timezone can only be matched to the zone reported by the current device. There is no free-text
zone or shipped zone list. When the device supplies no zone, or it already matches, the row is
read-only. The row states that changing timezone does not refill today's small stardust.

## Hosted tabs stay quiet until their owners land

The stardust and achievements tabs remain reachable from the first release of my page. Until their
own plans supply the ledger and achievement views, each shows a restrained unavailable line. My
page adds no purchase, charge, payment, progress, claim, or reward-status affordance.

## Export is delivery, not retained application state

Diary management offers CSV and Markdown export through the existing account-scoped export RPC.
The client invokes export imperatively, delivers the server filename as a web download or the
decoded text to the native share sheet, and retains no diary content in the query cache.

## Account actions are narrow

The account rows at the foot of the profile show the signed-in identity and linked Google/password
providers read-only. They offer neither provider linking, credential changes, nor email changes.
Sign-out keeps one plain confirmation and deletes nothing.

Withdrawal uses a second explicit confirmation. It states the configured soft-delete retention
period, offers CSV/Markdown export in place, then withdraws and immediately signs the local session
out. My page exposes no restore control, hard-delete action, or client-supplied user scope.
