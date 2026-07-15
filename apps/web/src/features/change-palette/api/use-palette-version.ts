import { useSyncExternalStore } from 'react'

import { paletteVersion, subscribeMoodPalette } from '@cosimosi/emotion'

// A React subscription to the active-palette version. The universe canvas memoizes each memory's
// mood color into instanced buffers, so a module-level palette swap is invisible to those memos;
// keying a remount on this version is what makes a live swap re-color, with no rendering-package
// edit and no data refetch. The version advances on every setMoodPalette/resetMoodPalette.
export function usePaletteVersion(): number {
  return useSyncExternalStore(subscribeMoodPalette, paletteVersion, paletteVersion)
}
