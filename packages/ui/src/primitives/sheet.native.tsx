import { useEffect, useRef } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { usePresence } from '../a11y/use-presence.ts'
import { color, fontSize, radius, space } from '../native-styles.ts'
import type { SheetOwnProps } from './types.ts'

export type SheetProps = SheetOwnProps

/** Matches the leave timing below — the timer, not the animation, is what unmounts. */
const EXIT_MS = 200

/**
 * The scrim-less surface, native. Not a `Modal`: a Modal takes the whole screen and every touch with
 * it, and this surface exists so the universe behind it keeps both. It is an absolutely-positioned
 * bottom sheet inside its host, so the canvas above it stays visible and gesture-interactive.
 *
 * It slides up from the edge it lives on and goes back out the same way, matching the web sibling, so
 * the surface reads as having come from somewhere rather than having replaced what was there. Under
 * reduced motion it simply appears and goes — the web collapses animations in `base.css`, and RN has no
 * equivalent, so the value is set rather than driven.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  closeDisabled = false,
  footer,
  children,
}: SheetProps) {
  // Held past the close so the surface can go back out the edge it came in from. A host that unmounts
  // the Sheet itself on close skips the leave — the element is gone before this can hold it.
  const { present, phase } = usePresence(open, EXIT_MS)
  // Progress away from rest: 0 is settled, 1 is off the bottom edge. Mapped to a translate below, so
  // how far the sheet travels stays the layout's business and not a number this animation knows.
  const offset = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const leaving = phase === 'leaving'
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return
        if (reduced) {
          offset.setValue(leaving ? 1 : 0)
          return
        }
        Animated.timing(offset, {
          toValue: leaving ? 1 : 0,
          duration: leaving ? EXIT_MS : 240,
          easing: leaving ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
      .catch(() => offset.setValue(leaving ? 1 : 0))
    return () => {
      cancelled = true
    }
  }, [offset, phase])

  if (!present) return null

  return (
    <Animated.View
      accessibilityLabel={typeof title === 'string' ? title : ariaLabel}
      style={[
        styles.sheet,
        {
          opacity: offset.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: offset.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }) },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : <View />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          accessibilityState={{ disabled: closeDisabled }}
          disabled={closeDisabled}
          onPress={onClose}
          style={styles.close}
        >
          <Text style={[styles.closeGlyph, closeDisabled && styles.closeGlyphDisabled]}>✕</Text>
        </Pressable>
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Bounded to the lower two thirds so the universe it is about stays the larger half of the screen.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '66%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space[5],
    paddingTop: space[5],
    // The home indicator's own band plus the room the last control needs above it.
    paddingBottom: space[6] + space[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[4],
  },
  title: { color: color.text, fontSize: fontSize.base, fontWeight: '600' },
  close: { padding: space[1] },
  closeGlyph: { color: color['text-muted'], fontSize: fontSize.base },
  closeGlyphDisabled: { opacity: 0.4 },
  description: { marginTop: space[1], color: color['text-muted'], fontSize: fontSize.sm },
  // flexShrink hands the leftover height to the body, so a consumer's ScrollView scrolls instead of
  // stretching the sheet past its bound.
  body: { marginTop: space[4], flexShrink: 1 },
  footer: { marginTop: space[4] },
})
