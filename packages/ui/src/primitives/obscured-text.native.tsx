import { StyleSheet, Text } from 'react-native'

import { color, fontSize } from '../native-styles.ts'
import type { ObscuredTextProps } from './types.ts'

/**
 * The RN half of the same API. React Native has no CSS `filter`, so the smear is made the way the
 * platform can make one: the run's own ink goes transparent and a wide, zero-offset text shadow is
 * left behind it — the glyph's light without the glyph's edges. Same picture, no extra dependency.
 */
export function ObscuredText({ spans }: ObscuredTextProps) {
  return (
    <Text style={styles.body}>
      {spans.map((span, index) => (
        // Keyed by position because the runs are a rendering of one immutable string: the same text
        // always yields the same list, so an index is stable for as long as the passage is.
        <Text key={index} style={span.obscured ? styles.obscured : undefined} selectable={false}>
          {span.text}
        </Text>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  body: { color: color.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.625 },
  obscured: {
    color: 'transparent',
    textShadowColor: color.text,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
})
