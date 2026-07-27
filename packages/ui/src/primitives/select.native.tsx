import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ControlSize, FieldOwnProps, SelectOwnProps } from './types.ts'

export type SelectProps = FieldOwnProps & SelectOwnProps

const HEIGHT: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }
const FONT: Record<ControlSize, number> = { sm: fontSize.sm, md: fontSize.base, lg: fontSize.lg }

// The RN half of the same API. There is no `<select>` here, so the field is a Pressable wearing the
// TextField well that opens a modal list — the shape a native picker actually takes, rather than a
// scroll wheel the design language never adopted.
//
// The modal is where the two platforms genuinely differ: on web the option list is the OS's and cannot
// be styled or mis-managed; here it is ours, so it borrows Dialog's discipline — RN's Modal manages its
// own focus and its own layer, and a tap on the backdrop dismisses without changing the value.
export function Select({
  items,
  value,
  onValueChange,
  label,
  description,
  error,
  ariaLabel,
  disabled,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const selected = items.find((item) => item.value === value)
  const name = typeof label === 'string' ? label : ariaLabel

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityValue={{ text: selected?.label }}
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.control,
          { height: HEIGHT[size] },
          error ? styles.invalid : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <Text style={[styles.valueText, { fontSize: FONT[size] }]} numberOfLines={1}>
          {selected?.label ?? ''}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Empty onPress stops a tap on the list from reaching the backdrop. */}
          <Pressable
            accessibilityViewIsModal
            accessibilityLabel={name}
            style={styles.sheet}
            onPress={() => {}}
          >
            <ScrollView>
              {items.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.value === value }}
                  onPress={() => {
                    onValueChange(item.value)
                    setOpen(false)
                  }}
                  style={styles.option}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.value === value ? <Text style={styles.optionMark}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: space[1] + 2 },
  label: { color: color.text, fontSize: fontSize.sm, fontWeight: '500' },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space[3],
  },
  invalid: { borderColor: color.danger },
  disabled: { opacity: 0.5 },
  valueText: { flexShrink: 1, color: color.text },
  chevron: { color: color['text-muted'], fontSize: fontSize.sm },
  description: { color: color['text-muted'], fontSize: fontSize.sm },
  error: { color: color.danger, fontSize: fontSize.sm },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.overlay,
    paddingHorizontal: space[4],
  },
  sheet: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '70%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingVertical: space[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  optionLabel: { flexShrink: 1, color: color.text, fontSize: fontSize.base },
  optionMark: { color: color.primary, fontSize: fontSize.base },
})
