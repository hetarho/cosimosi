// 단일 별을 자기 정사각 캔버스에 큼직하게 띄우는 편의 컴포넌트(히어로 엠블럼 등). 공유
// StarCanvas + Star3D 위에 얇게 얹는다 — 논리 박스 100x100의 중앙(50,50)에 큰 별 하나.
import { StarCanvas } from './StarCanvas'
import { Star3D } from './Star3D'
import type { LandingThemeId } from '../../model/theme'

export interface ThemedStarProps {
  concept: LandingThemeId
  /** mood hex(의미색). */
  color: string
  seed?: number
  brightness?: number
  active?: boolean
  /** 캔버스 픽셀 크기(정사각). */
  size?: number
  className?: string
}

export function ThemedStar({
  concept,
  color,
  seed = 1,
  brightness = 1,
  active = false,
  size = 200,
  className,
}: ThemedStarProps) {
  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden>
      <StarCanvas width={100} height={100} animated className="h-full w-full">
        <Star3D concept={concept} color={color} seed={seed} brightness={brightness} active={active} x={50} y={50} r={42} />
      </StarCanvas>
    </div>
  )
}
