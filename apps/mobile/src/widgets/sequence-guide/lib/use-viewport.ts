import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'

import type { SequenceViewport } from '@cosimosi/sequence'

function read(): SequenceViewport {
  const { width, height } = Dimensions.get('window')
  return { width, height }
}

// The window size the caption's placement rule reads. Subscribed rather than sampled once, so an
// orientation change that moves the highlighted control under the caption relocates it. `Dimensions`
// reports logical pixels, the same units the anchor rects use.
export function useViewport(): SequenceViewport {
  const [viewport, setViewport] = useState<SequenceViewport>(read)

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) =>
      setViewport({ width: window.width, height: window.height }),
    )
    return () => subscription.remove()
  }, [])

  return viewport
}
