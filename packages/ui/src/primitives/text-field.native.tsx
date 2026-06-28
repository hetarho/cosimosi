import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'

import { color, fontSize, radius, space } from '../native-styles.ts'
import type { ControlSize, FieldOwnProps } from './types.ts'

export type TextFieldProps = FieldOwnProps &
  Omit<TextInputProps, 'accessibilityLabel' | 'style'> & { style?: StyleProp<TextStyle> }

const HEIGHT: Record<ControlSize, number> = { sm: 32, md: 40, lg: 48 }
const FONT: Record<ControlSize, number> = { sm: fontSize.sm, md: fontSize.base, lg: fontSize.lg }

export function TextField({ label, description, error, size = 'md', style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={typeof label === 'string' ? label : undefined}
        placeholderTextColor={color['text-subtle']}
        style={[styles.control, { height: HEIGHT[size], fontSize: FONT[size] }, error ? styles.invalid : null, style]}
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
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space[3],
    color: color.text,
  },
  invalid: { borderColor: color.danger },
  description: { color: color['text-muted'], fontSize: fontSize.sm },
  error: { color: color.danger, fontSize: fontSize.sm },
})
