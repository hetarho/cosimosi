import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { FieldOwnProps } from './types.ts'

export type TextAreaProps = Omit<FieldOwnProps, 'size'> &
  Omit<TextInputProps, 'accessibilityLabel' | 'multiline' | 'style'> & { style?: StyleProp<TextStyle> }

export function TextArea({ label, description, error, style, ...rest }: TextAreaProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline
        textAlignVertical="top"
        accessibilityLabel={typeof label === 'string' ? label : undefined}
        placeholderTextColor={color['text-subtle']}
        style={[styles.control, error ? styles.invalid : null, style]}
        {...rest}
      />
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: space[1] + 2 },
  label: { color: color.text, fontSize: fontSize.sm, fontWeight: '500' },
  control: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    color: color.text,
    fontSize: fontSize.base,
  },
  invalid: { borderColor: color.danger },
  description: { color: color['text-muted'], fontSize: fontSize.sm },
  error: { color: color.danger, fontSize: fontSize.sm },
})
