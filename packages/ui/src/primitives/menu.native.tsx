import { Fragment, cloneElement, isValidElement, useState, type ReactElement } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { MenuOwnProps } from './types.ts'

export type MenuProps = MenuOwnProps

/**
 * The RN half of the same API. The list is an action sheet rather than a panel pinned to the
 * trigger: a phone has no room beside a control, and RN's `Modal` is what manages the layer and the
 * focus — the same reason `Select` opens one. `side` and `align` are therefore accepted and unused;
 * they describe where a list sits next to its trigger, and here it does not sit next to anything.
 *
 * The trigger is CLONED rather than wrapped, as it is on web. A caller's trigger is a `Pressable`
 * already, and a Pressable inside a Pressable takes the touch itself — a wrapper would leave the
 * control looking pressable and opening nothing.
 */
export function Menu({ items, trigger, ariaLabel }: MenuProps) {
  const [open, setOpen] = useState(false)

  const triggerControl = isValidElement(trigger)
    ? cloneElement(
        trigger as ReactElement<{
          onPress?: () => void
          accessibilityState?: { expanded?: boolean }
        }>,
        { onPress: () => setOpen(true), accessibilityState: { expanded: open } },
      )
    : trigger

  return (
    <Fragment>
      {triggerControl}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Empty onPress stops a tap on the list from reaching the backdrop. */}
          <Pressable
            accessibilityViewIsModal
            accessibilityLabel={ariaLabel}
            style={styles.sheet}
            onPress={() => {}}
          >
            <ScrollView>
              {items.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: Boolean(item.disabled) }}
                  disabled={item.disabled}
                  onPress={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  style={[styles.item, item.disabled ? styles.disabled : null]}
                >
                  <Text style={[styles.label, item.tone === 'danger' ? styles.danger : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Fragment>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: color.overlay,
    padding: space[4],
  },
  sheet: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '70%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color['surface-raised'],
    paddingVertical: space[2],
  },
  item: { paddingHorizontal: space[4], paddingVertical: space[3] },
  disabled: { opacity: 0.5 },
  label: { color: color.text, fontSize: fontSize.base },
  danger: { color: color.danger },
})
