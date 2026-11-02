import { useCallback, useEffect, useRef, useState } from 'react'
import { useMachine } from '@cosimosi/state-machine/react'
import { isEmptyAdvance, type AdvanceAnnouncement } from '../advance-interval.ts'
import { useAdvanceAnnouncementStore } from '../advance-announcement-store.ts'
import { releaseAdvance } from '../release-advance.ts'
import { useTimeSyncConsentStore } from '../time-sync-consent-store.ts'
import { universeTimeMachine, type UniverseTimePhase } from '../universe-time.machine.ts'

// useTimeAdvanceOverlay is the universe clock's overlay controller, shared by both apps: it plays an
// announced clock advance as a sweep, opens the sync-consent modal a caller requested, and releases
// what it played or cancels what it asked, so neither an awaken nor a caller is ever lost to an
// interrupted overlay.
export function useTimeAdvanceOverlay() {
  const [snapshot, send] = useMachine(universeTimeMachine)
  const phase = snapshot.value as UniverseTimePhase

  const pendingAdvance = useAdvanceAnnouncementStore((state) => state.pending)
  const consentPending = useTimeSyncConsentStore((state) => state.pending)
  const settle = useTimeSyncConsentStore((state) => state.settle)
  // The playing announcement is data outside the machine. It is state so the child prop is a clean
  // render read; the ref mirrors it only so the unmount cleanup reads the latest without a stale
  // closure.
  const [playing, setPlaying] = useState<AdvanceAnnouncement | null>(null)
  const playingRef = useRef<AdvanceAnnouncement | null>(null)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])
  const [sweepTime, setSweepTime] = useState<string | null>(null)

  // Consume the announce seam once idle: play a moving interval; an empty one (no time passed — e.g.
  // a sync landing on an already-current clock) releases its reveal immediately. Seed the HUD date to
  // the interval start so it never flashes a store value the refetch may already have advanced to
  // `current` before the first sweep tick lands.
  useEffect(() => {
    if (!pendingAdvance || phase !== 'idle') return
    const announcement = useAdvanceAnnouncementStore.getState().take()
    if (!announcement) return
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
    if (consentPending && phase === 'idle') send({ type: 'CONFIRM_SYNC' })
  }, [consentPending, phase, send])

  // On unmount: release a still-playing announcement (releaseAdvance is idempotent, so the awaken and
  // the clock landing are never lost to an interrupted sweep) and cancel a pending consent (a caller
  // awaiting the decision must never hang; an ambiguous exit never moves the clock).
  useEffect(
    () => () => {
      const played = playingRef.current
      if (played) releaseAdvance(played)
      if (useTimeSyncConsentStore.getState().pending)
        useTimeSyncConsentStore.getState().settle('cancel')
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
    if (played) releaseAdvance(played)
  }, [send])

  return {
    consenting: phase === 'confirming',
    playing,
    sweepTime: playing ? sweepTime : null,
    tick: setSweepTime,
    accept,
    reject,
    done,
  }
}
