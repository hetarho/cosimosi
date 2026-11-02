import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { DisclosureOwnProps } from './types.ts'

export function Disclosure({ label, children }: DisclosureOwnProps) {
  const [open, setOpen] = useState(false)
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={typeof label === 'string' ? label : undefined}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.trigger}
      >
        <Text accessibilityElementsHidden style={styles.label}>
          {open ? '−' : '+'}
        </Text>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      <View
        style={[styles.body, !open && styles.hidden]}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3] },
  label: { color: color['text-subtle'], fontSize: fontSize.sm },
  body: { gap: space[4], padding: space[4], borderRadius: radius.lg, backgroundColor: color.bg },
  hidden: { display: 'none' },
})
