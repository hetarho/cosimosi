import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { SheetOwnProps } from './types.ts'

export type SheetProps = SheetOwnProps

/**
 * The scrim-less surface, native. Not a `Modal`: a Modal takes the whole screen and every touch with
 * it, and this surface exists so the universe behind it keeps both. It is an absolutely-positioned
 * bottom sheet inside its host, so the canvas above it stays visible and gesture-interactive.
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
  if (!open) return null

  return (
    <View accessibilityLabel={typeof title === 'string' ? title : ariaLabel} style={styles.sheet}>
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
    </View>
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
    paddingBottom: space[6],
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
