import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // The probe-fixture patterns keep gate runs hermetic: a crashed lint probe's leftovers must
    // never fail an unrelated scan (quality-gates §Probe hermeticity).
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/.probe-*/**', '**/__boundary_probe_*/**'],
  },
  {
    // The universe scene scaffold. The domain-mirror stores, rendering-projection logic, and the
    // R3F rendering entities were promoted to packages (@cosimosi/universe, @cosimosi/universe-render)
    // so both apps share one source. What stays app-local is thin, single-reference by design and
    // must not be merged away: the universe widget (mounts the shared canvas + composes the package
    // layers; referenced only by the universe page) and the nebula notice (a forked DOM/RN affordance
    // shown over the canvas; referenced only by the universe page — its RENDERING half is the package
    // NebulaField). Scoped so a genuinely insignificant future slice still gets flagged.
    files: ['./src/entities/nebula/**', './src/widgets/universe-canvas/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // How the universe is held — 고정 모드 / 자유 모드 — is one user action with one host by design:
    // it belongs to the universe page's own chrome, and a second entry point would be a second place
    // to disagree about which way the camera is being flown. The mode itself is shared state in
    // @cosimosi/universe (the canvas reads it without a prop, because React context does not cross
    // the R3F reconciler); this slice is only the control. Scoped so a genuinely insignificant future
    // slice still gets flagged.
    files: ['./src/features/pin-universe-view/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The writing-flow vertical: four single-action feature slices composed by one widget, and that
    // widget mounted by the universe page. A single reference is the FSD grain here — a feature is
    // one user action (§3.1), not a slice to merge away. The episodic-memory entity holds the
    // proposal's shared display atoms (mood chip, neuron chips) that the preview and the editor both
    // render; every consumer sits in a slice this block already exempts, so the rule counts no
    // references for it — the same shape as the universe-clock entity below. Scoped to these slices
    // so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/entities/episodic-memory/**',
      './src/features/write-diary/**',
      './src/features/split-diary/**',
      './src/features/revise-split/**',
      './src/features/launch-stars/**',
      './src/widgets/writing-flow/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The decoration vertical has two single-action features composed by one panel widget,
    // mounted by the universe page — the same one-action grain as writing-flow and universe-time
    // above. Previewing an ornament and saving the choice are two different acts with different
    // guarantees (one is inert and reversible, one is the epic's only durable write), so merging them
    // would hide the difference the whole unit is built around. Scoped so a genuinely insignificant
    // future slice still gets flagged.
    files: [
      './src/features/preview-ornament/**',
      './src/features/buy-ornament/**',
      './src/widgets/decoration-panel/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The universe-time vertical has three single-surface features composed by one widget,
    // mounted by the universe page — the same one-action grain as writing-flow above. Recall flow
    // supplies the second reference by opening confirm-time-sync; merging them away would erase
    // the action boundaries. The clock entity is the vertical's pure domain mirror (substance in
    // @cosimosi/universe); every consumer (the canvas read, the HUD, the overlay) sits in a slice
    // this config already exempts, so the rule counts no references for it. Scoped so a genuinely
    // insignificant future slice still gets flagged.
    files: [
      './src/entities/universe-clock/**',
      './src/features/universe-clock-hud/**',
      './src/features/accelerate-time/**',
      './src/features/confirm-time-sync/**',
      './src/widgets/universe-time/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The star-detail vertical has three single-surface read features composed by one panel
    // widget, mounted by the universe page — the same one-action grain as writing-flow. A feature
    // is one user surface (§3.1), not a slice to merge away; later references arrive as the panel's
    // hand-offs light up (the recall flow it opens, the gist view a gist selection routes to).
    // Scoped so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/features/star-meta/**',
      './src/features/current-memory-text/**',
      './src/features/star-provenance/**',
      './src/widgets/star-detail/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The recall-flow vertical has one feature slice composed by one flow widget, opened by
    // the star-detail panel — the same one-action grain as writing-flow. A single reference is the
    // FSD grain here, not a slice to merge away. Scoped so a genuinely insignificant future slice
    // still gets flagged.
    files: ['./src/features/recall-star/**', './src/widgets/recall-flow/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The stardust economy vertical: a persistent balance-HUD feature, the earn guide and the way to
    // come by more, all composed by the stardust overlay widget (mounted by the universe page) into
    // the one 별가루 panel that reading opens; a REUSABLE cost-display feature the recall-flow and
    // star-detail (gist) widgets compose before a spend; and the ledger tab the /me page composes.
    // Low/single references are the FSD grain here — a feature is one user surface (§3.1), not a
    // slice to merge away. charge-twinkle is deliberately in the list while it performs nothing:
    // acquiring 별가루 is its own act with its own future `api`, and folding a placeholder into the
    // widget now would mean unpicking it the day the path exists. Scoped so a genuinely insignificant
    // future slice still gets flagged.
    files: [
      './src/features/twinkle-balance-hud/**',
      './src/features/spend-cost-display/**',
      './src/features/earn-twinkle/**',
      './src/features/charge-twinkle/**',
      './src/features/twinkle-ledger/**',
      './src/widgets/stardust/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The diary-reader vertical ([D2][D3]): the free archive read + the single paid whole-diary
    // recall action, composed by one reader widget and mounted by the reader page — the same
    // one-surface grain as the verticals above. The diary entity is the vertical's shared
    // read-model (substance in @cosimosi/universe). A single reference is the FSD grain here, not
    // a slice to merge away. diary-calendar is the SECOND SHAPE of the same vertical — the archive's month
    // view, peer to read-diary-list's row view — so it belongs in this scope rather than a block of its own,
    // which would claim it is a separate vertical. Scoped so a genuinely insignificant future slice still
    // gets flagged.
    files: [
      './src/entities/diary/**',
      './src/features/read-diary-list/**',
      './src/features/diary-calendar/**',
      './src/features/search-diary/**',
      './src/features/recall-diary-stars/**',
      './src/widgets/diary-reader/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The deletion + letting-go vertical ([X1][X4]): three single-action feature slices (full
    // delete, restore, letting-go) composed by one deletion-flow widget and opened from the
    // star-detail panel and the diary reader over the running canvas. A feature is one user action
    // (§3.1), not a slice to merge away; restore-memory is also mounted directly by the diary-reader
    // widget. Scoped so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/features/delete-memory/**',
      './src/features/restore-memory/**',
      './src/features/let-go/**',
      './src/widgets/deletion-flow/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The profile editor is one account action hosted by the /me profile tab. Its RPC/query
    // substance stays in shared packages; the slice owns only platform UI.
    files: ['./src/features/account-profile/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Withdrawal is one terminal account action hosted by the /me account tab.
    files: ['./src/features/withdraw-account/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The inviter share surface is one profile fact hosted by the /me profile tab.
    files: ['./src/features/invite-link/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The extended provider/sign-out feature remains one account action hosted by /me.
    files: ['./src/features/account-settings/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Export is deliberately mounted twice inside the same page slice (diary tab and withdrawal
    // confirmation). Steiger counts source slices rather than mount sites, so it observes one
    // reference even though the UI has two independently reachable compositions.
    files: ['./src/features/export-diaries/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Signup is one cross-platform entry action. Its pure control state and RPC seam live in
    // shared packages; the app slice intentionally contains only the platform-specific nickname
    // and invite acknowledgment UI composed by the app-layer profile gate.
    files: ['./src/features/sign-up/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The two color actions are deliberately thin app-local UI over shared emotion logic:
    // the first-signin chooser is composed once by the profile gate, and the later editor once by
    // /me. Merging either into those hosts would erase the action boundary and web/mobile parity.
    // The mood-color entity is their one web-only projection for the conic random swatch; both
    // consumers sit in the exempt feature slices, so Steiger observes no external reference.
    files: [
      './src/entities/mood-color/**',
      './src/features/choose-mood-colors/**',
      './src/features/change-mood-colors/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The admin console vertical's one web-only /admin page composes four sectioned
    // operator features — AI provider config, users + stardust grant, AI usage, and job health.
    // Each is one operator surface (§3.1: the page composes, never absorbs) and exists only there
    // BY DESIGN. Web-only (the parity rule is deliberately waived for this operational surface).
    // Scoped so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/features/admin-ai-config/**',
      './src/features/admin-users/**',
      './src/features/admin-usage/**',
      './src/features/admin-jobs/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The achievement vertical has the /me tab's list and the session-long unlock notice. Two
    // slices because they are two user moments — one you go to and read, one that finds you once and
    // says nothing more — and each has exactly one host by design: the tab is composed by /me, the
    // notice host is mounted by the authenticated layout (which is also the guard that a signed-out
    // visitor never fetches the list). Merging the list into /me would put a claim's orchestration in
    // a page, and merging the notice into the layout would hide that it is a feature at all. Scoped so
    // a genuinely insignificant future slice still gets flagged.
    files: ['./src/features/achievement-list/**', './src/features/achievement-notice/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The sequence-engine chrome has three slices composed by one guide widget, which
    // the host page mounts over whatever screen is beneath. Each is a distinct guarantee, not a
    // component — the highlight is decorative and may render nothing, the caption is the channel that
    // must never fail, and the skip is the one interactive element the chrome owns and the only slice
    // a user can press. Merging them would hide exactly the distinction the engine is built around,
    // and each has one host by design because a run has one chrome. Every model-level artifact is
    // shared verbatim through @cosimosi/sequence; only these `ui` segments are per-app. Scoped so a
    // genuinely insignificant future slice still gets flagged.
    files: [
      './src/features/highlight-next-control/**',
      './src/features/show-sequence-caption/**',
      './src/features/skip-sequence/**',
      './src/widgets/sequence-guide/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The onboarding replay row is one user action — starting the tour again — hosted by the
    // /me profile tab and nowhere else, by design: [O5] puts it in the settings page, and a second
    // entry point would be the "re-offer" the tour's own policy forbids. Merging it into the page would
    // put the request in a page and erase the action boundary. Scoped so a genuinely insignificant
    // future slice still gets flagged.
    files: ['./src/features/replay-onboarding/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The features layer's slice count is spec-governed (one plan authors each slice deliberately;
    // the inventory mirrors apps/mobile 1:1), so the fixed ungrouped-slice threshold (20) is not a
    // drift signal here — regrouping into slice folders would churn every import and the
    // web↔mobile parity lint for no structural gain. Slice hygiene stays enforced per slice by
    // fsd/insignificant-slice above.
    files: ['./src/features/**'],
    rules: {
      'fsd/excessive-slicing': 'off',
    },
  },
])
