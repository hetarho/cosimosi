import { useTimeAdvanceOverlay } from '@cosimosi/universe/react'

import { AccelerateTime } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseTimeHud } from '../../../entities/universe-clock/index.ts'
import type { OnboardingAnchor } from '@cosimosi/onboarding'

// widgets/universe-time: the time overlay over the running canvas — the HUD, the acceleration, and
// the consent modal composed by one machine phase (§3.1/§3.2). It imports no three / visual entity
// (§3.4): the veil is a DOM layer and the scene hears nothing — the transition stays neutral, and
// the forgetting/consolidation choreographies fill the reserved slot through the same interval
// seam. Render order matters: the veil (inside AccelerateTime) precedes the HUD so the sweeping
// date stays crisp above the dimmed scene.
//
// The onboarding `universe-clock` anchor is registered HERE rather than one layer up, because the page
// composes this widget as a fragment whose first element is the full-screen veil while an acceleration
// plays — a page-level wrapper would hand the highlight the veil's rect. This is a composition site
// like any other, so `features/universe-clock-hud` still knows nothing about a tour ([I13]).
export function UniverseTimeOverlay() {
  // Playing the announced advance, the consent modal and their release on unmount are the package's
  // time-advance overlay controller; this widget composes the sweep driver, the HUD and the dialog.
  const { consenting, playing, sweepTime, tick, accept, reject, done } = useTimeAdvanceOverlay()

  return (
    <>
      {playing ? <AccelerateTime interval={playing.interval} onTick={tick} onDone={done} /> : null}
      <SequenceAnchor id={'universe-clock' satisfies OnboardingAnchor}>
        <UniverseTimeHud overrideTime={sweepTime} />
      </SequenceAnchor>
      <ConfirmTimeSyncDialog open={consenting} onAccept={accept} onReject={reject} />
    </>
  )
}
