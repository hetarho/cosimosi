import { readFileSync } from 'node:fs'

import { defineScript } from '@cosimosi/sequence'
import { describe, expect, it } from 'vitest'

import type { OnboardingAnchor, OnboardingSignal } from './anchors.ts'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

// Exhaustive records: a member added to either union without a row here fails to compile, and a row
// naming something the union does not have fails too — so the counts below cannot drift silently.
const ANCHOR_INVENTORY: Readonly<Record<OnboardingAnchor, true>> = {
  'universe-write-entry': true,
  'writing-draft': true,
  'writing-proposal': true,
  'writing-confirm': true,
  'universe-clock': true,
}

const SIGNAL_INVENTORY: Readonly<Record<OnboardingSignal, true>> = {
  'writing-flow-opened': true,
  'split-succeeded': true,
  'launch-succeeded': true,
}

describe('the closed unions', () => {
  it('admits exactly five controls and three outcomes', () => {
    expect(Object.keys(ANCHOR_INVENTORY)).toHaveLength(5)
    expect(Object.keys(SIGNAL_INVENTORY)).toHaveLength(3)
  })

  it('names no paid, destructive, decorative or clock-moving control', () => {
    // The absence IS the guard. Each `@ts-expect-error` below fails the typecheck the day the union
    // grows a member that would make the step spellable — which is the whole point of a compile-time
    // vocabulary over a review rule.
    const unspellable = defineScript<OnboardingAnchor, OnboardingSignal>({
      id: 'unspellable',
      steps: [
        {
          id: 'a paid reconsolidation',
          caption: () => 'never rendered',
          // @ts-expect-error no recall anchor exists, so no step can point at a control that spends.
          anchor: 'recall-memory',
          advance: { on: 'dwell' },
        },
        {
          id: 'a memory destroyed for the demonstration',
          caption: () => 'never rendered',
          // @ts-expect-error no deletion anchor exists.
          anchor: 'let-go',
          advance: { on: 'dwell' },
        },
        {
          id: 'a render parameter changed for effect',
          caption: () => 'never rendered',
          // @ts-expect-error no palette or ornament anchor exists.
          anchor: 'mood-palette',
          advance: { on: 'dwell' },
        },
        {
          id: 'an emergent coordinate treated as a control',
          caption: () => 'never rendered',
          // @ts-expect-error no anchor for a rendered memory exists: its position comes out of the force
          // sim and changes every frame, so there is no composition site and no rect to measure.
          anchor: 'rendered-memory',
          advance: { on: 'dwell' },
        },
        {
          id: 'universe time moved so dimming becomes visible',
          caption: () => 'never rendered',
          // @ts-expect-error no clock or sync signal exists.
          advance: { on: 'signal', signal: 'clock-advanced' },
        },
      ],
    })
    expect(unspellable.steps).toHaveLength(5)
  })
})

describe('package isolation', () => {
  it('declares no dependency that could reach a transport, a fixture or a read mirror', () => {
    // An assertion rather than a review habit: this list is why "the tour created a memory" is
    // unrepresentable. Anything added here has to be defensible against [I13] and [U2] first — and note
    // the edge runs auth → onboarding (the reset inventory), so auth is absent by necessity too.
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@cosimosi/i18n',
      '@cosimosi/sequence',
      'zustand',
    ])
    expect(Object.keys(manifest.peerDependencies).sort()).toEqual(['react'])
  })
})
