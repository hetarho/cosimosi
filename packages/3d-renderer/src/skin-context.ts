import { createContext, use } from 'react'
import { isSkinKey, type SkinKey, type UniverseSkin } from './skin/presets.ts'
import { UNIVERSE_SKINS } from './skin/presets.ts'

export interface SkinContextValue {
  readonly skin: UniverseSkin
  readonly skinKey: SkinKey
  readonly setSkinKey: (key: SkinKey) => void
}

export const SkinContext = createContext<SkinContextValue | null>(null)

/** Resolve the build-time active skin key (from generated config) to a valid SkinKey. */
export function resolveActiveSkin(activeSkin: string): SkinKey {
  return isSkinKey(activeSkin) ? activeSkin : 'aurora'
}

export function skinValue(skinKey: SkinKey, setSkinKey: (key: SkinKey) => void): SkinContextValue {
  return { skin: UNIVERSE_SKINS[skinKey], skinKey, setSkinKey }
}

export function useSkin(): SkinContextValue {
  const ctx = use(SkinContext)
  if (ctx === null) throw new Error('useSkin must be used within <SkinProvider>')
  return ctx
}
