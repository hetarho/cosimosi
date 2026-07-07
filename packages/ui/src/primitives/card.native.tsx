import { StyleSheet, View, type ViewProps } from 'react-native'

import { color, radius, space } from '../native-styles.ts'
import type { CardOwnProps } from './types.ts'

export type CardProps = CardOwnProps & ViewProps

// Native counterpart of the web Card, same API. RN has no backdrop-filter, so the `glass` variant is
// approximated with the elevated surface tone (a true frosted blur needs a native blur lib — deferred
// with the other glass primitives); `solid` is the opaque content surface.
export function Card({ variant = 'solid', style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.base, variant === 'glass' ? styles.glass : styles.solid, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.xl, padding: space[4], borderWidth: 1, borderColor: color.border },
  solid: { backgroundColor: color.surface },
  glass: { backgroundColor: color['surface-raised'] },
})
