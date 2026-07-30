import { StyleSheet, Text, View } from 'react-native'

import type { CaptionPlacement, SequenceCaption as CaptionAccessor } from '@cosimosi/sequence'
import { tokens } from '@cosimosi/ui'

export const CAPTION_BAND_HEIGHT = 112

// features/show-sequence-caption ui (RN fork, [O2]): one line of guidance, bottom center. It is the
// guaranteed channel of the whole engine — the highlight can fail to resolve, the caption cannot —
// which is why it is a POLITE live region: a step change is announced without stealing the reader's
// place, and the run stays followable with no highlight at all.
//
// The accessor is called at render time rather than resolved once, so a locale switch mid-run
// re-renders this line.
export function SequenceCaption({
  caption,
  placement,
}: {
  caption: CaptionAccessor
  placement: CaptionPlacement
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.band, placement === 'top' ? styles.top : styles.bottom]}
    >
      <Text style={styles.caption}>{caption()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: CAPTION_BAND_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  top: { top: 0 },
  bottom: { bottom: 0 },
  caption: {
    maxWidth: 420,
    backgroundColor: tokens.color['surface-raised'],
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    textAlign: 'center',
    color: tokens.color.text,
    fontSize: tokens.fontSize.sm,
  },
})
