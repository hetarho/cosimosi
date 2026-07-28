import { Pressable, StyleSheet, Text, View } from 'react-native'

import { color, radius, space } from '../native-styles.ts'
import type { SegmentedControlOwnProps } from './types.ts'

export type SegmentedControlProps = SegmentedControlOwnProps

// A bounded choice whose options all stay visible. It is a RADIOGROUP, not a tablist: the segments
// select a value, they do not swap a panel.
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={ariaLabel} style={styles.group}>
      {items.map((item) => {
        const selected = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={item.label}
            disabled={disabled}
            onPress={() => onValueChange(item.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: space[1],
    borderColor: color.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: color.surface,
    padding: space[1],
  },
  segment: {
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  selected: { backgroundColor: color.bg },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { color: color['text-muted'], fontSize: 14 },
  selectedLabel: { color: color.text, fontWeight: '600' },
})
