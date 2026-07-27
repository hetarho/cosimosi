import { StyleSheet, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'

// entities/episodic-memory ui (RN fork): a memory's `Emotion` as a bare dot, for the places a chip
// would be too much — beside a field label, in a dense row. Decorative by construction: the colour is
// the emotion package's projection and the meaning always sits in the words next to it
// (design-language §2.3). `MoodChip` is the labelled form.
export function MoodDot({ mood }: { mood: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, { backgroundColor: moodColor(mood as Mood) }]}
    />
  )
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 999 },
})
