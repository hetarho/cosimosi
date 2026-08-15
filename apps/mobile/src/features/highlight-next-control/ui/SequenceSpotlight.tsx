import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'

import { VALUES } from '@cosimosi/config'
import type { SequenceRect } from '@cosimosi/sequence'
import { tokens, useReducedMotion } from '@cosimosi/ui'

// features/highlight-next-control ui (RN fork, [O2]): a ring over the measured rect of the control the
// current step names. Non-modal by construction — `pointerEvents="none"` and
// `accessibilityElementsHidden`, no backdrop, nothing disabled — so the screen underneath stays fully
// operable INCLUDING the controls this step does not name. The real control keeps its own
// accessibility and press handling because nothing here is able to take them.
//
// It renders nothing when the anchor could not be measured: the caption is the guaranteed channel and
// the highlight is an enhancement. Shares every model-level artifact with web through
// @cosimosi/sequence; only this ring is forked, because RN has no CSS animation.
export function SequenceSpotlight({ rect }: { rect: SequenceRect | null }) {
  const reducedMotion = useReducedMotion()
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (reducedMotion || !rect) {
      pulse.setValue(1)
      return
    }
    const half = VALUES.sequence.highlightPulseMs / 2
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    // Stopped on every rect/preference change and on unmount, so no run leaves an animation driving
    // a view that is gone.
    return () => loop.stop()
  }, [pulse, reducedMotion, rect])

  if (!rect) return null

  // Hoisted out of the JSX because it cannot live in a StyleSheet and must not read as one: the box
  // follows a measured rect (in logical pixels relative to the app window — the same units on both
  // platforms) and the opacity is a driven Animated.Value. Everything static about the ring is in
  // `styles.ring`.
  const measured = {
    left: rect.x - RING_PADDING,
    top: rect.y - RING_PADDING,
    width: rect.width + RING_PADDING * 2,
    height: rect.height + RING_PADDING * 2,
    opacity: reducedMotion ? 1 : pulse,
  }

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.ring, measured]}
    />
  )
}

// Slice-local geometry: how far the ring stands off the control it circles. Visual language, not a
// shared tuning value; it belongs only to this chrome.
const RING_PADDING = 8

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: tokens.color.primary,
    borderRadius: tokens.radius.lg,
  },
})
