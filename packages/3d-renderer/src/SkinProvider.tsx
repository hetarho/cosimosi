import { useMemo, useState, type ReactNode } from 'react'
import { SkinContext, skinValue } from './skin-context.ts'
import type { SkinKey } from './skin/presets.ts'

// The skin seam. `defaultSkin` is the build-time active skin (the app passes
// resolveActiveSkin(VALUES.rendering.active_skin)); setSkinKey is exposed so a future
// end-user runtime switcher ([P4]) drives it without any consumer change.
export function SkinProvider({ children, defaultSkin = 'aurora' }: { children: ReactNode; defaultSkin?: SkinKey }) {
  const [skinKey, setSkinKey] = useState<SkinKey>(defaultSkin)
  const value = useMemo(() => skinValue(skinKey, setSkinKey), [skinKey])
  return <SkinContext value={value}>{children}</SkinContext>
}
