import { describe, expect, it } from 'vitest'

import {
  OrnamentAcquisition as WireAcquisition,
  OrnamentKind as WireKind,
} from '@cosimosi/api-client'

import {
  DEFAULT_ORNAMENT_IDS,
  ORNAMENT_KINDS,
  ornamentIdOf,
  ornamentRegistryKey,
  ornamentRows,
  ornamentSelectionRows,
  selectedRegistryKey,
} from './ornament.ts'

describe('ornament ids', () => {
  it('splits an id into its kind prefix and registry key, and refuses a foreign one', () => {
    expect(ornamentRegistryKey('BACKGROUND', 'background.soft-aurora')).toBe('soft-aurora')
    expect(ornamentRegistryKey('STAR_SHADER', 'star_shader.geode')).toBe('geode')
    // A cross-kind id is not silently reinterpreted — the schema refuses to store one either.
    expect(ornamentRegistryKey('STAR_SHADER', 'background.soft-aurora')).toBeNull()
    expect(ornamentRegistryKey('BACKGROUND', 'background.')).toBeNull()
    expect(ornamentRegistryKey('BACKGROUND', 'grainient')).toBeNull()
  })

  it('round-trips every kind default through its id', () => {
    for (const kind of ORNAMENT_KINDS) {
      const key = ornamentRegistryKey(kind, DEFAULT_ORNAMENT_IDS[kind])
      expect(key, kind).not.toBeNull()
      expect(ornamentIdOf(kind, key as string)).toBe(DEFAULT_ORNAMENT_IDS[kind])
    }
  })
})

describe('applied selection', () => {
  it('falls back to a kind default when the selection is absent or unreadable', () => {
    expect(selectedRegistryKey([], 'BACKGROUND')).toBe('grainient')
    expect(selectedRegistryKey([], 'STAR_SHADER')).toBe('facet')
    expect(
      selectedRegistryKey([{ kind: 'BACKGROUND', ornamentId: 'star_shader.geode' }], 'BACKGROUND'),
    ).toBe('grainient')
  })

  it('reads the applied key for each kind independently', () => {
    const rows = [
      { kind: 'BACKGROUND', ornamentId: 'background.lightfall' },
      { kind: 'STAR_SHADER', ornamentId: 'star_shader.spire' },
    ] as const
    expect(selectedRegistryKey(rows, 'BACKGROUND')).toBe('lightfall')
    expect(selectedRegistryKey(rows, 'STAR_SHADER')).toBe('spire')
  })
})

describe('wire mapping', () => {
  it('maps catalog rows and drops kinds or acquisitions it cannot name', () => {
    const rows = ornamentRows([
      {
        $typeName: 'cosimosi.store.v1.Ornament',
        ornamentId: 'background.lightfall',
        kind: WireKind.BACKGROUND,
        acquisition: WireAcquisition.PURCHASE,
        price: 300n,
        owned: false,
        selected: false,
      },
      {
        $typeName: 'cosimosi.store.v1.Ornament',
        ornamentId: 'background.unknowable',
        kind: WireKind.UNSPECIFIED,
        acquisition: WireAcquisition.PURCHASE,
        price: 300n,
        owned: false,
        selected: false,
      },
    ])
    expect(rows).toEqual([
      {
        id: 'background.lightfall',
        kind: 'BACKGROUND',
        acquisition: 'PURCHASE',
        price: 300,
        owned: false,
        selected: false,
      },
    ])
  })

  it('maps selection rows and drops an unnameable kind', () => {
    expect(
      ornamentSelectionRows([
        {
          $typeName: 'cosimosi.store.v1.OrnamentSelection',
          kind: WireKind.STAR_SHADER,
          ornamentId: 'star_shader.haze',
        },
        {
          $typeName: 'cosimosi.store.v1.OrnamentSelection',
          kind: WireKind.UNSPECIFIED,
          ornamentId: 'nothing.here',
        },
      ]),
    ).toEqual([{ kind: 'STAR_SHADER', ornamentId: 'star_shader.haze' }])
  })
})
