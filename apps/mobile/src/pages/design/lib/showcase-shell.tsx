import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

/**
 * The native showcase's layout vocabulary — a section, a labelled specimen, and the stage a
 * specimen sits on. Review furniture, not product components: it exists so every specimen is framed
 * the same way and a reviewer compares like with like. Built from the same tokens as everything
 * else, so it can never become a second design language sitting beside the first.
 *
 * The web shell's `StateMatrix` has no counterpart here on purpose: hover and keyboard focus do not
 * exist on a touch surface, and pressed lives under a finger rather than in a wrapper class. The
 * states this surface can hold are resting, disabled and busy, shown as real props.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

export function Specimen({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <View style={styles.specimen}>
      <Text style={styles.eyebrow}>{label}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
    </View>
  )
}

/** The neutral stage — opaque, so a control is judged on its own material. */
export function Stage({ children, row }: { children: ReactNode; row?: boolean }) {
  return <View style={[styles.stage, row ? styles.stageRow : styles.stageColumn]}>{children}</View>
}

const styles = StyleSheet.create({
  section: {
    gap: tokens.spacing[4],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.spacing[6],
  },
  sectionTitle: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  sectionBody: { gap: tokens.spacing[6] },
  specimen: { gap: tokens.spacing[3] },
  eyebrow: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  note: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs, lineHeight: 18 },
  stage: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  stageColumn: { flexDirection: 'column' },
})
