import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// Every block below cites the ARCH decision that makes its exemption policy rather than drift, and
// `fsd/insignificant-slice` is off only for slices Steiger would otherwise flag. Steiger counts no
// reference from a slice this config exempts, so a slice whose importers are all exempt needs an entry
// too; one with two importers outside the list needs none. The FSD layout lint fails a path that
// matches no file and a block with no citation.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // ARCH-43: the probe-fixture patterns keep gate runs hermetic — a crashed lint probe's leftovers
    // must never fail an unrelated scan.
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/.probe-*/**', '**/__boundary_probe_*/**'],
  },
  {
    // ARCH-21: the universe screen's own chrome. The canvas widget mounts the shared scene for the one
    // page that shows it, and how the universe is held (고정 / 자유) is one action with one host —
    // a second entry point would be a second place to disagree about how the camera is flown.
    files: ['./src/widgets/universe-canvas/**', './src/features/pin-universe-view/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the writing vertical — one-action features (write, revise the split, launch) composed
    // by one single-host widget. A feature is one user action, not a slice to merge away. The memory,
    // emotion and neuron entities hold the views these and the star panel render.
    files: [
      './src/entities/episodic-memory/**',
      './src/entities/emotion/**',
      './src/entities/neuron/**',
      './src/features/write-diary/**',
      './src/features/revise-split/**',
      './src/features/launch-stars/**',
      './src/widgets/writing-flow/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: previewing an ornament and saving the choice are two acts with different guarantees
    // (one inert and reversible, one the decoration's only durable write), composed by one panel.
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
    // ARCH-21: the universe-time vertical — the clock entity, the acceleration and time-sync consent
    // actions and the overlay widget that composes them over the canvas.
    files: [
      './src/entities/universe-clock/**',
      './src/features/accelerate-time/**',
      './src/features/confirm-time-sync/**',
      './src/widgets/universe-time/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: single-host widgets binding one product controller — the star panel and the recall
    // flow it opens — and the recall action the flow composes.
    files: [
      './src/widgets/star-detail/**',
      './src/widgets/recall-flow/**',
      './src/features/recall-star/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the stardust overlay widget and the earn guide and charge control its panel holds, the
    // cost display the paid flows compose before a spend, and the ledger tab /me composes — each one
    // user surface; the twinkle entity is the balance reading they all show.
    files: [
      './src/entities/twinkle/**',
      './src/features/spend-cost-display/**',
      './src/widgets/stardust/**',
      './src/features/earn-twinkle/**',
      './src/features/charge-twinkle/**',
      './src/features/twinkle-ledger/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the diary reader — the list and month shapes of the archive, its conditions and the
    // whole-diary recall action, composed by one reader widget.
    files: [
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
    // ARCH-21: full delete, restore and letting go are three actions the deletion flow composes.
    files: [
      './src/features/delete-memory/**',
      './src/features/restore-memory/**',
      './src/features/let-go/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the account home's actions, each hosted once by a /me tab — profile, providers and
    // sign-out, withdrawal, the invite link, export, replaying the tour, the achievement list and the
    // colour editor. Merging any into the page would put its request in a page.
    files: [
      './src/features/account-profile/**',
      './src/features/account-settings/**',
      './src/features/withdraw-account/**',
      './src/features/invite-link/**',
      './src/features/export-diaries/**',
      './src/features/replay-onboarding/**',
      './src/features/achievement-list/**',
      './src/features/change-mood-colors/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the web-only /admin page composes four operator surfaces, each existing only there by
    // design.
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
    // ARCH-21: skipping is the one control the sequence chrome owns, and a run has one chrome.
    files: ['./src/features/skip-sequence/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // ARCH-21: the features layer's slices are one action each and mirror apps/mobile 1:1, so the
    // fixed ungrouped-slice threshold is not a drift signal here.
    files: ['./src/features/**'],
    rules: {
      'fsd/excessive-slicing': 'off',
    },
  },
])
