import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ToastOwnProps, ToastVariant } from './types.ts'

export type ToastProps = ToastOwnProps

// Mirror web's per-variant role: only warning/danger announce assertively. RN has no
// 'status' role, so info/success carry no role and lean on the polite live region.
const ROLE: Record<ToastVariant, 'alert' | undefined> = {
  info: undefined,
  success: undefined,
  warning: 'alert',
  danger: 'alert',
}

const TONE: Record<ToastVariant, string> = {
  info: color.border,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
}

export function Toast({ open, onOpenChange, variant = 'info', durationMs, children }: ToastProps) {
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open || !durationMs) return
    const timer = setTimeout(() => onOpenChangeRef.current(false), durationMs)
    return () => clearTimeout(timer)
  }, [open, durationMs])

  if (!open) return null

  return (
    <View
      accessibilityRole={ROLE[variant]}
      accessibilityLiveRegion={
        variant === 'warning' || variant === 'danger' ? 'assertive' : 'polite'
      }
      style={[styles.toast, { borderColor: TONE[variant] }]}
    >
      <Text style={styles.text}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: color['surface-raised'],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  text: { color: color.text, fontSize: fontSize.sm },
})
