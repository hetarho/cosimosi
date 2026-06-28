import { Text, View } from 'react-native'

import type { VisuallyHiddenProps } from './types.ts'

export type { VisuallyHiddenProps }

/** Keep content in the accessibility tree while collapsing it visually. */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return (
    <View style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
      <Text>{children}</Text>
    </View>
  )
}
