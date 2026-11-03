import { useEffect } from 'react'
import { VALUES } from '@cosimosi/config'
import type { DecorationTourStage } from './decoration-tour.ts'

/** Each real sky selection gets its own view; leaving the guide cancels the pending handoff. */
export function useDecorationSkyPreview(
  stage: DecorationTourStage,
  background: string | null,
  active: boolean,
  onComplete: () => void,
): void {
  useEffect(() => {
    if (!active || stage !== 'sky-preview') return
    const timer = setTimeout(onComplete, VALUES.demo.decorationSkyPreviewMs)
    return () => clearTimeout(timer)
  }, [stage, background, active, onComplete])
}
