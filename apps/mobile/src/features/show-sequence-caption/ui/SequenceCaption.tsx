import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

import type { CaptionPosition, SequenceCaption as CaptionAccessor } from '@cosimosi/sequence'
import { tokens } from '@cosimosi/ui'

/** The reading height the placement resolver budgets for this line — what it reserves when it works
 *  out whether the band fits clear of a control or a surface. */
export const CAPTION_BAND_HEIGHT = 112

// features/show-sequence-caption ui (RN fork, [O2]): one line of guidance. It is the guaranteed
// channel of the whole engine — the highlight can fail to resolve, the caption cannot — which is why
// it is a POLITE live region: a step change is announced without stealing the reader's place, and the
// run stays followable with no highlight at all.
//
// WHERE the line goes is the resolver's decision, arriving as one `CaptionPosition` this file only
// renders — the same split the web fork keeps, so the two platforms cannot disagree about placement
// while agreeing about everything else.
//
// The accessor is called at render time rather than resolved once, so a locale switch mid-run
// re-renders this line.
export function SequenceCaption({
  caption,
  position,
}: {
  caption: CaptionAccessor
  position: CaptionPosition
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.band, bandPosition(position)]}
    >
      <Text style={styles.caption}>{caption()}</Text>
    </View>
  )
}

function bandPosition(position: CaptionPosition): ViewStyle {
  switch (position.from) {
    case 'top':
      return { top: position.insetPx }
    case 'bottom':
      return { bottom: position.insetPx }
    // A percentage top puts the band's own top edge on the midline, so it is lifted by half its
    // reserved height to centre the line ON it — the same budget the resolver used to decide the
    // midline was free, rather than a second guess at the rendered height.
    case 'midline':
      return {
        top: `${position.fraction * 100}%`,
        transform: [{ translateY: -CAPTION_BAND_HEIGHT / 2 }],
      }
  }
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
