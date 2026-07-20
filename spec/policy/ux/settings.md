# policy/ux: settings

> UX policy for the settings surface. Plan [52.settings-page](../../plan/52.settings-page.md) owns the implementation;
> the palette engine/registry/preference it hosts is plan [51.palette-customization](../../plan/51.palette-customization.md),
> the session/sign-out it reads is plan [04.auth-session](../../plan/04.auth-session.md), and the route/gate it assumes
> is plan [53.auth-universe-gate](../../plan/53.auth-universe-gate.md). Reinforces [I3][I11] and PRD [P1]–[P4][U1].

## One settings home

Account, palette change, and staging customization live on a **single settings screen** — web `/settings`, mobile
`SettingsScreen` — reached from a restrained affordance on the universe page and gated behind auth by the plan-53
entry rule (PRD §1.6). No settings concern is scattered into ad-hoc menus elsewhere.

## Account is basic

The account section shows the signed-in identity **read from the session snapshot** (the `userId` — no new fetch) and
a **sign out** action behind one plain confirm ("정말 로그아웃할까요?" — honest, no friction theater). Nothing else:
profile edit, credentials, billing, and account deletion are outside v1 settings (memory deletion is the Epic-H flow;
account deletion is a later plan). Sign-out only transitions the session — the gate routes to login and **nothing is
deleted** ([I1]).

## Palette change is hosted, not owned

The palette section mounts plan 51's `change-palette` feature: it lists the **registry** (each palette named through
i18n), marks the **stored preference**, and routes a selection through 51's **set-and-apply** path (optimistic
re-color via the single `setMoodPalette` entry + persisted preference + revert on failure) ([P1][M6]). Only
guardrail-respecting registry palettes are offered — **no free palette editor exists**, so the axis-consistency rule
([P3]) is surfaced here and owned by 51.

## Staging customization is non-meaning-only and reserved in v1

The staging (연출) section is a **visible, disabled placeholder** ([P4]): it names background · theme · effect ·
camera-mood, says the space opens later, and states the boundary — customization touches non-meaning layers only. It
ships **no editable control**, so nothing on the page can override "color = emotion", set a star's emotion, or touch
position/strength — the meaning-layer guarantee is structural, not copy ([P2][I3][I11]). The slot reserves plan 14's
build-time `rendering.active_skin` / `useSkin` seam as what later staging work makes user-choosable.
