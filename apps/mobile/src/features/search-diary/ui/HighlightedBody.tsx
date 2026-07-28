import { StyleSheet, Text } from 'react-native'

import { highlightSegments } from '@cosimosi/memory'
import { tokens } from '@cosimosi/ui'

export interface HighlightedBodyProps {
  /** A stretch of the diary's immutable body — never a memory's current or decayed text ([D10]). */
  text: string
  query: string
}

// features/search-diary ui ([D9][D10]): marks the keyword inside text the row is already showing.
// It highlights in place and never re-centres on the hit, so the preview stays the prefix
// diaryPreview produced. The marked runs are nested <Text>, so the caller's own <Text> keeps owning
// numberOfLines and the base style.
export function HighlightedBody({ text, query }: HighlightedBodyProps) {
  const segments = highlightSegments(text, query)
  if (segments.length === 1 && !segments[0]?.match) return text

  return (
    <>
      {segments.map((segment, index) => (
        <Text key={index} style={segment.match ? styles.match : undefined}>
          {segment.text}
        </Text>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  // Marked typographically rather than with a fill: the palette has no highlight role, and a weight +
  // underline reads on every theme without inventing one.
  match: { color: tokens.color.text, fontWeight: '600', textDecorationLine: 'underline' },
})
