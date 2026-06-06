import type { LandingThemeId } from '../../model/theme'
import { AuroraBackground } from './AuroraBackground'
import { DeepFieldBackground } from './DeepFieldBackground'
import { LiquidBackground } from './LiquidBackground'
import { EmberBackground } from './EmberBackground'

/** 테마 식별자 → 배경 atmosphere 컴포넌트. */
export function LandingBackground({ theme }: { theme: LandingThemeId }) {
  switch (theme) {
    case 'aurora':
      return <AuroraBackground />
    case 'liquid':
      return <LiquidBackground />
    case 'ember':
      return <EmberBackground />
    case 'deepfield':
    default:
      return <DeepFieldBackground />
  }
}
