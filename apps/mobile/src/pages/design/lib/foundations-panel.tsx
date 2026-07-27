import { StyleSheet, Text, View } from 'react-native'

import { palette, tokens, type ColorToken } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'
import { Section, Specimen, Stage } from './showcase-shell.tsx'

/**
 * Foundations on native: the role map, the type roles, and the two geometric scales.
 *
 * The roles are read from the registry rather than listed here, so a theme added in packages/ui
 * shows up on this screen without anyone editing it — the same property the web surface has.
 */

const ROLE_ORDER = Object.keys(palette) as readonly ColorToken[]

// The six type roles, as the web table states them. Native has no Tailwind class, so each is spelled
// from the same token scale — size carries hierarchy, weight carries emphasis.
const TYPE_ROLES: readonly { role: string; style: object }[] = [
  { role: 'display', style: { fontSize: tokens.fontSize['2xl'], fontWeight: '600' } },
  { role: 'title', style: { fontSize: tokens.fontSize.xl, fontWeight: '600' } },
  { role: 'section', style: { fontSize: tokens.fontSize.lg, fontWeight: '600' } },
  { role: 'body', style: { fontSize: tokens.fontSize.base, lineHeight: 28 } },
  {
    role: 'small',
    style: { fontSize: tokens.fontSize.sm, lineHeight: 24, color: tokens.color['text-muted'] },
  },
  {
    role: 'eyebrow',
    style: {
      fontSize: tokens.fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: tokens.color['text-subtle'],
    },
  },
]

const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8] as const
const RADIUS_STEPS = (['sm', 'md', 'lg', 'xl', 'full'] as const).map((label) => ({
  label,
  value: tokens.radius[label],
}))

export function FoundationsPanel() {
  return (
    <Section title={T.foundationsTitle}>
      <Specimen label={T.themeLabel} note={T.themeNote}>
        <View style={styles.swatchGrid}>
          {ROLE_ORDER.map((role) => (
            <View key={role} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: tokens.color[role] }]} />
              <Text style={styles.swatchLabel}>{role}</Text>
            </View>
          ))}
        </View>
      </Specimen>

      <Specimen label={T.typeLabel}>
        <Stage>
          {TYPE_ROLES.map(({ role, style }) => (
            <View key={role} style={styles.typeRow}>
              <Text style={styles.typeRole}>{role}</Text>
              <Text style={[styles.typeSpecimen, style]}>{T.typeSpecimen}</Text>
            </View>
          ))}
        </Stage>
      </Specimen>

      <Specimen label={T.spacingLabel}>
        <Stage>
          {SPACING_STEPS.map((step) => (
            <View key={step} style={styles.scaleRow}>
              <Text style={styles.scaleLabel}>{step}</Text>
              <View style={[styles.scaleBar, { width: tokens.spacing[step] * 4 }]} />
              <Text style={styles.scaleValue}>{tokens.spacing[step]}</Text>
            </View>
          ))}
        </Stage>
      </Specimen>

      <Specimen label={T.radiusLabel}>
        <Stage row>
          {RADIUS_STEPS.map(({ label, value }) => (
            <View key={label} style={styles.radiusCell}>
              <View style={[styles.radiusBox, { borderRadius: value }]} />
              <Text style={styles.scaleLabel}>{label}</Text>
            </View>
          ))}
        </Stage>
      </Specimen>
    </Section>
  )
}

const styles = StyleSheet.create({
  swatchGrid: { gap: tokens.spacing[2] },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  swatchLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  typeRow: { gap: tokens.spacing[1] },
  typeRole: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    textTransform: 'uppercase',
  },
  typeSpecimen: { color: tokens.color.text },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  scaleLabel: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs, width: 28 },
  scaleValue: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  scaleBar: { height: 8, borderRadius: tokens.radius.full, backgroundColor: tokens.color.primary },
  radiusCell: { alignItems: 'center', gap: tokens.spacing[2] },
  radiusBox: {
    width: 44,
    height: 44,
    backgroundColor: tokens.color['surface-raised'],
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
})
