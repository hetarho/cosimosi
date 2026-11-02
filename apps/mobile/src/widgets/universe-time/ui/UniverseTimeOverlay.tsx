import { StyleSheet, View } from 'react-native'

import { useTimeAdvanceOverlay } from '@cosimosi/universe/react'

import { AccelerateTime } from '../../../features/accelerate-time/index.ts'
import { ConfirmTimeSyncDialog } from '../../../features/confirm-time-sync/index.ts'
import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseTimeHud } from '../../../entities/universe-clock/index.ts'
import type { OnboardingAnchor } from '@cosimosi/onboarding'

// widgets/universe-time (RN fork): the time overlay over the running canvas — the HUD, the
// acceleration, and the consent modal composed by one machine phase (§3.1/§3.2). Shares model/api
// with web verbatim; only this host + the HUD/dialog primitives fork (§3.5). It imports no three /
// visual entity (§3.4). It lays out as a centred row inside the screen's top chrome, which is what
// owns the device inset — the acceleration renders nothing (the scene says time passing) and the
// consent modal is an RN `Modal` at the root, so nothing here needs to position against the screen.
//
// The onboarding `universe-clock` anchor is registered HERE, around the HUD box rather than around
// this widget: the two siblings beside it draw nothing, so a wrapper one layer up would hand the
// highlight a box measured from a component with no visible content. This is a composition site like
// any other, so `features/universe-clock-hud` still knows nothing about a tour ([I13]).
export function UniverseTimeOverlay() {
  // Playing the announced advance, the consent modal and their release on unmount are the package's
  // time-advance overlay controller; this widget composes the sweep driver, the HUD and the dialog.
  const { consenting, playing, sweepTime, tick, accept, reject, done } = useTimeAdvanceOverlay()

  return (
    <>
      {playing ? <AccelerateTime interval={playing.interval} onTick={tick} onDone={done} /> : null}
      {/* Centred on the screen rather than tucked into a corner ([T6]): the universe's time is a
          reading that belongs to the place. The device inset is the top chrome's, one layer up. */}
      <View style={styles.hud} pointerEvents="none">
        <SequenceAnchor id={'universe-clock' satisfies OnboardingAnchor}>
          <UniverseTimeHud overrideTime={sweepTime} />
        </SequenceAnchor>
      </View>
      <ConfirmTimeSyncDialog open={consenting} onAccept={accept} onReject={reject} />
    </>
  )
}

const styles = StyleSheet.create({
  hud: { alignItems: 'center' },
})
