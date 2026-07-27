import { StyleSheet, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'
import { Badge } from '@cosimosi/ui'

import { moodLabel } from '../../../shared/i18n/index.ts'

// entities/episodic-memory ui (RN fork of the web chip): a memory's primary `Emotion`. The mood
// label always travels with its colour and never the colour alone — the dot is decorative, the word
// is the cue (design-language §2.3). The hue is the emotion package's mood→colour projection, read
// here and never re-derived. The dot sits beside the chip rather than inside it: the native Badge
// renders its children as text, so a coloured view belongs next to it, not within.
export function MoodChip({ mood }: { mood: string }) {
  return (
    <View style={styles.row}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.dot, { backgroundColor: moodColor(mood as Mood) }]}
      />
      <Badge variant="neutral">{moodLabel(mood)}</Badge>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 999 },
})
