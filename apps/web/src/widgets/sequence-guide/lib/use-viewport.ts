import { useEffect, useState } from 'react'

import type { SequenceViewport } from '@cosimosi/sequence'

const SSR_VIEWPORT: SequenceViewport = { width: 0, height: 0 }

// The window size the caption's placement rule reads, tracked rather than sampled during render so
// the caption relocates when a resize moves the highlighted control under it. It opens at zero so
// the first server render has no `window` to reach for; the mount effect fills it in.
export function useViewport(): SequenceViewport {
  const [viewport, setViewport] = useState<SequenceViewport>(SSR_VIEWPORT)

  useEffect(() => {
    const read = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  return viewport
}
