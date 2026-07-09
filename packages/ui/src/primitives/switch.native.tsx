import { useState } from 'react'
import { Switch as RNSwitch, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, space } from '../native-styles.ts'
import type { ToggleOwnProps } from './types.ts'

export type SwitchProps = ToggleOwnProps

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  ariaLabel,
  disabled,
}: SwitchProps) {
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internal

  return (
    <View style={styles.row}>
      <RNSwitch
        value={value}
        disabled={disabled}
        accessibilityLabel={typeof label === 'string' ? label : ariaLabel}
        trackColor={{ true: color.primary, false: color['surface-raised'] }}
        onValueChange={(next) => {
          if (!isControlled) setInternal(next)
          onCheckedChange?.(next)
        }}
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { color: color.text, fontSize: fontSize.sm },
})
