import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'

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
 *
 * `toggle` is the SECOND shape, mirroring the web sibling: for a choice between exactly two, the
 * whole track becomes ONE press that lands on the other option. It stops being a radiogroup there
 * and becomes a switch — a press on the option already held changes the value, which is the one
 * thing a radio must never do — and its label carries the option currently held, so the state a
 * reader hears is the one they can see.
 */
export function SegmentedControl({
  items,
  value,
  onValueChange,
  ariaLabel,
  disabled = false,
  toggle = false,
}: SegmentedControlProps) {
  const reducedMotion = useReducedMotion()
  const [boxes, setBoxes] = useState<readonly (SegmentBox | undefined)[]>([])
  const selectedIndex = items.findIndex((item) => item.value === value)
  const [offset] = useState(() => new Animated.Value(0))
  const selectedBox = selectedIndex === -1 ? undefined : boxes[selectedIndex]
  const [first, second] = items
  const asSwitch = toggle && first !== undefined && second !== undefined && items.length === 2

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

  // Each segment reports its own box whichever shape is showing — the thumb reads the same
  // measurements either way.
  const measure = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setBoxes((current) => {
      const held = current[index]
      if (held && held.x === x && held.width === width) return current
      const next = [...current]
      next[index] = { x, width }
      return next
    })
  }

  // Hidden until its segment has been measured, and while the value is outside the set — a thumb
  // under the first segment would tell the eye a selection `accessibilityState` denies.
  const thumb = selectedBox && (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.thumb, { width: selectedBox.width, transform: [{ translateX: offset }] }]}
    />
  )

  if (asSwitch) {
    const held = selectedIndex === -1 ? undefined : items[selectedIndex]
    const other = selectedIndex === 1 ? first : second
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: selectedIndex === 1, disabled }}
        accessibilityLabel={held ? `${ariaLabel}: ${held.label}` : ariaLabel}
        disabled={disabled}
        onPress={() => onValueChange(other.value)}
        style={({ pressed }) => [
          styles.group,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {thumb}
        {items.map((item, index) => (
          // The labels are the switch's two states, not two controls: the press and the name belong
          // to the track above, so these are ink only.
          <View
            key={item.value}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={measure(index)}
            style={styles.segment}
          >
            <Text style={[styles.label, item.value === value && styles.selectedLabel]}>
              {item.label}
            </Text>
          </View>
        ))}
      </Pressable>
    )
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={ariaLabel} style={styles.group}>
      {thumb}
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
            onLayout={measure(index)}
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
