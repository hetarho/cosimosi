import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

import { tokens, useReducedMotion } from '@cosimosi/ui'
import { advanceDurationMs, advanceSweepFrame, type AdvanceInterval } from '@cosimosi/universe'

export interface AccelerateTimeProps {
  interval: AdvanceInterval
  /** Fires once per sampled date while the sweep runs — the widget hands it to the HUD. */
  onTick: (universeTime: string) => void
  onDone: () => void
}

// The neutral time-passing transition ([T2]) — the RN fork of the web veil (§3.5, primitive
// differs: Animated.View vs a DOM layer). The reserved choreography slot ([V8][C8]) the
// forgetting-dimming and gist-rising choreographies fill off the same interval. Two threads: the
// veil runs as a single native-driver Animated.timing (the skeleton.native precedent) whose sin
// easing gives the 0 → peak → 0 envelope, so it stays smooth on the busiest JS frame right after a
// launch; a lightweight rAF loop only sets the ≤maxDateSteps HUD dates (which must stay on JS) and
// signals completion off the callback's own timestamp so the sweep is deterministic under tests.
export function AccelerateTime({ interval, onTick, onDone }: AccelerateTimeProps) {
  const veilOpacity = useRef(new Animated.Value(0)).current
  const reducedMotion = useReducedMotion()
  const callbacksRef = useRef({ onTick, onDone })
  callbacksRef.current = { onTick, onDone }

  useEffect(() => {
    if (reducedMotion) {
      callbacksRef.current.onTick(interval.current)
      callbacksRef.current.onDone()
      return
    }
    const duration = advanceDurationMs(interval)
    const veil = Animated.timing(veilOpacity, {
      toValue: VEIL_MAX_OPACITY,
      duration,
      // The easing IS the envelope: sin(πt) rises to 1 at the midpoint and returns to 0, so the
      // veil dims in and lifts back out over the one timing rather than needing a sequence.
      easing: (t: number) => Math.sin(Math.PI * t),
      useNativeDriver: true,
    })
    veil.start()

    let frame = 0
    let start: number | null = null
    let lastShown: string | null = null
    const step = (now: number) => {
      if (start === null) {
        start = now
      }
      const { universeTime, done } = advanceSweepFrame(interval, now - start)
      if (universeTime !== lastShown) {
        lastShown = universeTime
        callbacksRef.current.onTick(universeTime)
      }
      if (done) {
        callbacksRef.current.onDone()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      veil.stop()
      veilOpacity.setValue(0)
    }
  }, [interval, reducedMotion, veilOpacity])

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.veil, { opacity: veilOpacity }]}
    />
  )
}

// Presentation constant (code-level, the camera-rig precedent). Lower than the web veil on purpose:
// the RN veil is a flat full-screen fill (no radial vignette), so it must stay light enough that the
// scene centre — where the launched star reveals — reads through it at the sweep's midpoint.
const VEIL_MAX_OPACITY = 0.45

const styles = StyleSheet.create({
  veil: { backgroundColor: tokens.color.bg },
})
