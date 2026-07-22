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
import { UniverseTimeHud } from '../../../features/universe-clock-hud/index.ts'
import { useMachine } from '../../../shared/model/index.ts'
import { releaseAdvance } from '@cosimosi/universe'

// widgets/universe-time (RN fork): the time overlay over the running canvas — the HUD, the
// acceleration, and the consent modal composed by one machine phase (§3.1/§3.2). Shares model/api
// with web verbatim; only this host + the veil/HUD/dialog primitives fork (§3.5). It imports no
// three / visual entity (§3.4). Mounted as a direct child of the screen root so the absolute veil
// and HUD position against the full screen; the veil precedes the HUD so the sweeping date stays
// crisp above the dimmed scene.
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
      <View style={styles.hud} pointerEvents="none">
        <UniverseTimeHud overrideTime={playing ? sweepTime : null} />
      </View>
      <ConfirmTimeSyncDialog open={phase === 'confirming'} onAccept={accept} onReject={reject} />
    </>
  )
}

const styles = StyleSheet.create({
  hud: { position: 'absolute', right: 16, top: 24, alignItems: 'flex-end' },
})
