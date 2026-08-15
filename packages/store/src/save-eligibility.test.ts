import { describe, expect, it } from 'vitest'

import { DEFAULT_ORNAMENT_IDS, type Ornament } from './ornament.ts'
import type { OrnamentIDsByKind } from './ornament-preview-store.ts'
import { ornamentCost, saveVerdict, unownedTotal } from './save-eligibility.ts'

function row(partial: Partial<Ornament> & Pick<Ornament, 'id' | 'kind'>): Ornament {
  return {
    acquisition: 'PURCHASE',
    price: 300,
    owned: false,
    selected: false,
    ...partial,
  }
}

const CATALOG: readonly Ornament[] = [
  row({
    id: DEFAULT_ORNAMENT_IDS.BACKGROUND,
    kind: 'BACKGROUND',
    acquisition: 'FREE',
    price: 0,
    owned: true,
  }),
  row({ id: 'background.lightfall', kind: 'BACKGROUND' }),
  row({ id: 'background.grainstorm', kind: 'BACKGROUND', owned: true }),
  row({
    id: 'background.floating-lines',
    kind: 'BACKGROUND',
    acquisition: 'ACHIEVEMENT',
    price: 0,
  }),
  row({
    id: DEFAULT_ORNAMENT_IDS.STAR_SHADER,
    kind: 'STAR_SHADER',
    acquisition: 'FREE',
    price: 0,
    owned: true,
  }),
  row({ id: 'star_shader.geode', kind: 'STAR_SHADER', price: 600 }),
]

/** A whole selection: every kind at its default, with the named ones overridden. Written this way
 *  rather than as a literal per case because a selection is exhaustive by type — spelling five kinds
 *  into a dozen literals would make every future kind a test-wide edit and say nothing extra. */
function preview(overrides: Partial<OrnamentIDsByKind> = {}): OrnamentIDsByKind {
  return { ...DEFAULT_ORNAMENT_IDS, ...overrides }
}

const CONFIRMED = preview()

describe('ornament cost', () => {
  // Ownership shows up as the ABSENCE of a price, so there is no boolean for a badge to render.
  it('reads as no cost when owned, a price when not, and a condition when unbuyable', () => {
    expect(ornamentCost(CATALOG[2])).toEqual({ kind: 'none' })
    expect(ornamentCost(CATALOG[1])).toEqual({ kind: 'price', amount: 300 })
    expect(ornamentCost(CATALOG[3])).toEqual({ kind: 'condition', achievementId: null })
  })
})

describe('unowned total', () => {
  it('counts only the previewed rows that are unowned and priced', () => {
    expect(
      unownedTotal(
        CATALOG,
        preview({ BACKGROUND: 'background.lightfall', STAR_SHADER: 'star_shader.geode' }),
      ),
    ).toBe(900)
    // Owned and free rows contribute nothing — wearing something you own is not a transaction.
    expect(unownedTotal(CATALOG, preview({ BACKGROUND: 'background.grainstorm' }))).toBe(0)
  })
})

describe('save verdict', () => {
  it('says unchanged when nothing moved', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: CONFIRMED,
        confirmed: CONFIRMED,
        generalBalance: 0,
        balanceLoaded: true,
      }),
    ).toEqual({
      kind: 'unchanged',
    })
  })

  it('says free when the change costs nothing', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: preview({ BACKGROUND: 'background.grainstorm' }),
        confirmed: CONFIRMED,
        generalBalance: 0,
        balanceLoaded: true,
      }),
    ).toEqual({ kind: 'free' })
  })

  it('says ready with the total when the balance covers it', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: preview({
          BACKGROUND: 'background.lightfall',
          STAR_SHADER: 'star_shader.geode',
        }),
        confirmed: CONFIRMED,
        generalBalance: 900,
        balanceLoaded: true,
      }),
    ).toEqual({ kind: 'ready', amount: 900 })
  })

  // Cheapest-first, the same rule the server uses for its own refusal — so the two never point at
  // different rows.
  it('names the item the balance runs out on', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: preview({
          BACKGROUND: 'background.lightfall',
          STAR_SHADER: 'star_shader.geode',
        }),
        confirmed: CONFIRMED,
        generalBalance: 300,
        balanceLoaded: true,
      }),
    ).toEqual({ kind: 'shortfall', amount: 600, ornamentId: 'star_shader.geode' })
  })

  // An unachieved reward blocks the save whatever the balance is: it is not expensive, it is not for
  // sale — and the server refuses it independently.
  // An unread balance is zero, and zero looks exactly like broke — so before the read lands the verdict
  // must not refuse on the server's behalf.
  it('does not claim a shortfall while the balance is still unread', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: preview({
          BACKGROUND: 'background.lightfall',
          STAR_SHADER: 'star_shader.geode',
        }),
        confirmed: CONFIRMED,
        generalBalance: 0,
        balanceLoaded: false,
      }),
    ).toEqual({ kind: 'ready', amount: 900 })
  })

  it('says locked for an unachieved reward, whatever the balance', () => {
    expect(
      saveVerdict({
        catalog: CATALOG,
        previewed: preview({ BACKGROUND: 'background.floating-lines' }),
        confirmed: CONFIRMED,
        generalBalance: 10_000,
        balanceLoaded: true,
      }),
    ).toEqual({ kind: 'locked', ornamentId: 'background.floating-lines' })
  })
})
