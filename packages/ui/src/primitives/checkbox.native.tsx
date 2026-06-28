import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ToggleOwnProps } from './types.ts'

export type CheckboxProps = ToggleOwnProps

export function Checkbox({ checked, defaultChecked, onCheckedChange, label, ariaLabel, disabled }: CheckboxProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internal

  const toggle = () => {
    if (disabled) return
    const next = !value
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={typeof label === 'string' ? label : ariaLabel}
      disabled={disabled}
      onPress={toggle}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      <View style={[styles.box, value ? styles.boxOn : styles.boxOff]}>
        {value ? <Text style={styles.check}>✓</Text> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  disabled: { opacity: 0.5 },
  box: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1 },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
  boxOff: { borderColor: color.border },
  check: { color: color['primary-foreground'], fontSize: fontSize.xs },
  label: { color: color.text, fontSize: fontSize.sm },
})
