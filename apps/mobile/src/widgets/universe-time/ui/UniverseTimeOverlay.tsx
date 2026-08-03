import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  isEmptyAdvance,
  universeTimeMachine,
  type AdvanceAnnouncement,
  type UniverseTimePhase,
} from '@cosimosi/universe'

import {
  AccelerateTime,
  useAdvanceAnnouncementStore,
} from '../../../features/accelerate-time/index.ts'
import {
  ConfirmTimeSyncDialog,
  useTimeSyncConsentStore,
} from '../../../features/confirm-time-sync/index.ts'
import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { UniverseTimeHud } from '../../../features/universe-clock-hud/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { releaseAdvance } from '@cosimosi/universe'
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
  const [snapshot, send] = useMachine(universeTimeMachine)
  const phase = snapshot.value as UniverseTimePhase

  const pendingAdvance = useAdvanceAnnouncementStore((state) => state.pending)
  const consentPending = useTimeSyncConsentStore((state) => state.pending)
  const settle = useTimeSyncConsentStore((state) => state.settle)
  // The playing announcement is data outside the machine (§3.2). It is state so the child prop is a
  // clean render read; the ref mirrors it only so the unmount cleanup reads the latest without a
  // stale closure.
  const [playing, setPlaying] = useState<AdvanceAnnouncement | null>(null)
  const playingRef = useRef<AdvanceAnnouncement | null>(null)
  playingRef.current = playing
  const [sweepTime, setSweepTime] = useState<string | null>(null)

  // Consume the announce seam once idle: play a moving interval; an empty one (no time passed —
  // e.g. a sync landing on an already-current clock) releases its reveal immediately. Seed the HUD
  // date to the interval start so it never flashes a store value the refetch may already have
  // advanced to `current` before the first sweep tick lands.
  useEffect(() => {
    if (!pendingAdvance || phase !== 'idle') {
      return
    }
    const announcement = useAdvanceAnnouncementStore.getState().take()
    if (!announcement) {
      return
    }
    if (isEmptyAdvance(announcement.interval)) {
      releaseAdvance(announcement)
      return
    }
    setPlaying(announcement)
    setSweepTime(announcement.interval.previous ?? announcement.interval.current)
    send({ type: 'ADVANCED', empty: false })
  }, [pendingAdvance, phase, send])

  // A requested decision (회고하기 → requestTimeSyncConsent) opens the consent modal.
  useEffect(() => {
    if (consentPending && phase === 'idle') {
      send({ type: 'CONFIRM_SYNC' })
    }
  }, [consentPending, phase, send])

  // On unmount: release a still-playing announcement (releaseAdvance is idempotent, so the awaken
  // and the clock landing are never lost to an interrupted sweep) and cancel a pending consent (a
  // caller awaiting the decision must never hang; an ambiguous exit never moves the clock).
  useEffect(
    () => () => {
      const played = playingRef.current
      if (played) {
        releaseAdvance(played)
      }
      if (useTimeSyncConsentStore.getState().pending) {
        useTimeSyncConsentStore.getState().settle('cancel')
      }
    },
    [],
  )

  const accept = useCallback(() => {
    settle('proceed')
    send({ type: 'ACCEPT' })
  }, [settle, send])

  const reject = useCallback(() => {
    settle('cancel')
    send({ type: 'REJECT' })
  }, [settle, send])

  const done = useCallback(() => {
    const played = playingRef.current
    setPlaying(null)
    setSweepTime(null)
    send({ type: 'DONE' })
    if (played) {
      releaseAdvance(played)
    }
  }, [send])

  return (
    <>
      {playing ? (
        <AccelerateTime interval={playing.interval} onTick={setSweepTime} onDone={done} />
      ) : null}
      {/* Centred on the screen rather than tucked into a corner ([T6]): the universe's time is a
          reading that belongs to the place. The device inset is the top chrome's, one layer up. */}
      <View style={styles.hud} pointerEvents="none">
        <SequenceAnchor id={'universe-clock' satisfies OnboardingAnchor}>
          <UniverseTimeHud overrideTime={playing ? sweepTime : null} />
        </SequenceAnchor>
      </View>
      <ConfirmTimeSyncDialog open={phase === 'confirming'} onAccept={accept} onReject={reject} />
    </>
  )
}

const styles = StyleSheet.create({
  hud: { alignItems: 'center' },
})
