import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { DialogOwnProps } from './types.ts'

export type DialogProps = DialogOwnProps

export function Dialog({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  closeLabel,
  children,
}: DialogProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Empty onPress stops a tap on the panel from reaching the backdrop. */}
        <Pressable
          accessibilityViewIsModal
          accessibilityLabel={typeof title === 'string' ? title : ariaLabel}
          style={styles.panel}
          onPress={() => {}}
        >
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : <View />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <View style={styles.body}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.overlay,
    paddingHorizontal: space[4],
  },
  panel: {
    width: '100%',
    maxWidth: 448,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[4],
  },
  title: { color: color.text, fontSize: fontSize.lg, fontWeight: '600' },
  close: { padding: space[1] },
  closeGlyph: { color: color['text-muted'], fontSize: fontSize.base },
  description: { marginTop: space[1], color: color['text-muted'], fontSize: fontSize.sm },
  body: { marginTop: space[4] },
})
