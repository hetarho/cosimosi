import { StyleSheet, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'
import { tokens } from '@cosimosi/ui'

// entities/emotion ui (RN fork): an `Emotion` as a bare dot, for the places a chip would be too much —
// beside a field label, in a dense row, under a calendar day. Decorative by construction: the colour
// is the emotion package's projection and the meaning always sits in the words next to it (UI-34).
// `MoodChip` is the labelled form. `muted` dims a dot that stands for an option not chosen.
export function MoodDot({
  mood,
  size = 'md',
  muted = false,
}: {
  mood: string
  size?: 'sm' | 'md'
  muted?: boolean
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        size === 'sm' ? styles.small : styles.medium,
        { backgroundColor: moodColor(mood as Mood) },
        muted && styles.muted,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  small: { width: 8, height: 8, borderRadius: tokens.radius.full },
  medium: { width: 10, height: 10, borderRadius: tokens.radius.full },
  muted: { opacity: 0.4 },
})
