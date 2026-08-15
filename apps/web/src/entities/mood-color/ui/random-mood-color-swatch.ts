import type { CSSProperties } from 'react'

import { clampChromaToGamut, okLchToColor } from '@cosimosi/emotion'

// Random has no colour to show, so it shows all of them. Drawn through the same OkLCH seam every
// emotion colour goes through, so the wheel holds colours a feeling could actually get.
export const RANDOM_MOOD_COLOR_SWATCH: CSSProperties = {
  backgroundImage: `conic-gradient(${Array.from({ length: 13 }, (_, index) =>
    okLchToColor(clampChromaToGamut({ l: 0.72, c: 0.2, h: (index * 360) / 12 })),
  ).join(', ')})`,
}
