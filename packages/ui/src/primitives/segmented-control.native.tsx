import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'

import { useReducedMotion } from '../a11y/use-reduced-motion.native.ts'
import { color, radius, space } from '../native-styles.ts'
import type { SegmentedControlOwnProps } from './types.ts'

export type SegmentedControlProps = SegmentedControlOwnProps

/** One segment's measured box within the track. */
interface SegmentBox {
  readonly x: number
  readonly width: number
}

/**
 * A bounded choice whose options all stay visible. It is a RADIOGROUP, not a tablist: the segments
 * select a value, they do not swap a panel.
 *
 * The held choice is carried by a thumb that slides beneath the labels, as on web — the movement is
 * what says which one changed. Two things genuinely differ from the web sibling. React Native has no
 * CSS layer to collapse that motion, so this one asks `useReducedMotion()` and lands the thumb
 * without travelling when the preference is on. And a native transform takes pixels rather than a
 * percentage, so the thumb reads each segment's own measured box instead of a fraction of the track:
 * that keeps the segments at their label widths, so the control still hugs its content rather than
 * stretching across whatever row it sits in.
 */
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps) {
  const reducedMotion = useReducedMotion()
  const [boxes, setBoxes] = useState<readonly (SegmentBox | undefined)[]>([])
  const selectedIndex = items.findIndex((item) => item.value === value)
  const [offset] = useState(() => new Animated.Value(0))
  const selectedBox = selectedIndex === -1 ? undefined : boxes[selectedIndex]

  useEffect(() => {
    if (!selectedBox) return
    if (reducedMotion) {
      offset.setValue(selectedBox.x)
      return
    }
    const travel = Animated.timing(offset, {
      toValue: selectedBox.x,
      duration: 200,
      useNativeDriver: true,
    })
    travel.start()
    return () => travel.stop()
  }, [selectedBox, offset, reducedMotion])

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={ariaLabel} style={styles.group}>
      {/* Hidden until its segment has been measured, and while the value is outside the set — a thumb
          under the first segment would tell the eye a selection `accessibilityState` denies. */}
      {selectedBox && (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.thumb, { width: selectedBox.width, transform: [{ translateX: offset }] }]}
        />
      )}
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={item.label}
            disabled={disabled}
            onPress={() => onValueChange(item.value)}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout
              setBoxes((current) => {
                const held = current[index]
                if (held && held.x === x && held.width === width) return current
                const next = [...current]
                next[index] = { x, width }
                return next
              })
            }}
            style={({ pressed }) => [
              styles.segment,
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
    borderColor: color.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: color.surface,
    padding: space[1],
  },
  // `left: 0` with a measured translate, because the segment's own `x` is already relative to the
  // track's content box — the padding is in that origin, not something to add back.
  thumb: {
    position: 'absolute',
    top: space[1],
    bottom: space[1],
    left: space[1],
    borderRadius: radius.md,
    backgroundColor: color['surface-raised'],
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { color: color['text-muted'], fontSize: 14 },
  selectedLabel: { color: color.text, fontWeight: '600' },
})
