import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
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
    // The decoration vertical (plan 73): two single-action features composed by one panel widget,
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
    // The universe-time vertical (plan 31): three single-surface features composed by one widget,
    // mounted by the universe page — the same one-action grain as writing-flow above. Epic C adds
    // the second reference (recall-flow-ui opens confirm-time-sync); merging them away would undo
    // the plan's slice shape. The clock entity is the vertical's pure domain mirror (substance in
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
    // The star-detail vertical (plan 35): three single-surface read features composed by one panel
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
    // The recall-flow vertical (plan 36): one feature slice composed by one flow widget, opened by
    // the star-detail panel — the same one-action grain as writing-flow. A single reference is the
    // FSD grain here, not a slice to merge away. Scoped so a genuinely insignificant future slice
    // still gets flagged.
    files: ['./src/features/recall-star/**', './src/widgets/recall-flow/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The stardust economy vertical: a persistent balance-HUD feature and an earn guide composed by
    // the stardust overlay widget (mounted by the universe page), a REUSABLE cost-display feature the
    // recall-flow and star-detail (gist) widgets compose before a spend, and the ledger tab the /me
    // page composes. Low/single references are the FSD grain here — a feature is one user surface
    // (§3.1), not a slice to merge away. Scoped so a genuinely insignificant future slice still gets
    // flagged.
    files: [
      './src/features/twinkle-balance-hud/**',
      './src/features/spend-cost-display/**',
      './src/features/earn-twinkle/**',
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
    // Plan 51's two color actions are deliberately thin app-local UI over shared emotion logic:
    // the first-signin chooser is composed once by the profile gate, and the later editor once by
    // /me. Merging either into those hosts would erase the action boundary and web/mobile parity.
    files: ['./src/features/choose-mood-colors/**', './src/features/change-mood-colors/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The admin console vertical (plan 58): the one web-only /admin page composes four sectioned
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
