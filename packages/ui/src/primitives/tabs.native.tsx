import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { color, radius, space } from '../native-styles.ts'
import type { TabsOwnProps } from './types.ts'

export type TabsProps = TabsOwnProps

export function Tabs({ items, value, onValueChange, ariaLabel }: TabsProps) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      accessibilityLabel={ariaLabel}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => onValueChange(item.value)}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: space[1],
    borderColor: color.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: color.surface,
    padding: space[1],
  },
  tab: {
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  selected: { backgroundColor: color.bg },
  pressed: { opacity: 0.7 },
  label: { color: color['text-muted'], fontSize: 14 },
  selectedLabel: { color: color.text, fontWeight: '600' },
})
