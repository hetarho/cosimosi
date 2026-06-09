import type { Theme } from '@/entities/appearance'
import { VastBackground } from './VastBackground'
import { LivelyBackground } from './LivelyBackground'
import { CalmBackground } from './CalmBackground'

/** 색 테마 → 배경 atmosphere 컴포넌트(별 오브제 형태와 독립). */
export function LandingBackground({ theme }: { theme: Theme }) {
  switch (theme) {
    case 'lively':
      return <LivelyBackground />
    case 'calm':
      return <CalmBackground />
    case 'vast':
    default:
      return <VastBackground />
  }
}
