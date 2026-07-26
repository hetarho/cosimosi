# UX policy: my page

## One signed-in account home

My page is the sole signed-in account surface: web `/me` and mobile `Me`, reached from the
universe. It has exactly five tabs in this order: profile, stardust, achievements, diary
management, and account. Web keeps the active tab in the `tab` query parameter so links and reloads
preserve it; mobile keeps it as local screen state. Missing or unknown web values show profile.

Decoration does not live here. My page offers no palette, background, shader, camera, effect, or
other control that can reach a star's meaning or presentation. The former settings staging slot is
retired rather than filled.

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

The account tab shows the signed-in identity and linked Google/password providers read-only. It
offers neither provider linking, credential changes, nor email changes. Sign-out keeps one plain
confirmation and deletes nothing.

Withdrawal uses a second explicit confirmation. It states the configured soft-delete retention
period, offers CSV/Markdown export in place, then withdraws and immediately signs the local session
out. My page exposes no restore control, hard-delete action, or client-supplied user scope.
