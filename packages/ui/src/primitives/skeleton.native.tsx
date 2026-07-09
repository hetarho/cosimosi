import { useEffect, useRef } from 'react'
import { Animated, Easing, type DimensionValue } from 'react-native'

import { color, radius } from '../native-styles.ts'
import { useReducedMotion } from '../a11y/use-reduced-motion.native.ts'
import type { SkeletonOwnProps } from './types.ts'

export type SkeletonProps = SkeletonOwnProps

const ROUNDED: Record<NonNullable<SkeletonOwnProps['rounded']>, number> = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  full: radius.full,
}

export function Skeleton({ width, height, rounded = 'md' }: SkeletonProps) {
  const reduced = useReducedMotion()
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.6)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reduced, opacity])

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: width as DimensionValue,
        height: height as DimensionValue,
        opacity,
        borderRadius: ROUNDED[rounded],
        backgroundColor: color['surface-raised'],
      }}
    />
  )
}
