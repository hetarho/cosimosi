// 단일 별을 자기 정사각 영역에 큼직하게 띄우는 편의 컴포넌트(히어로 엠블럼 등). 논리 박스를 별의
// ~4배(160)로 크게 잡아 halo(r*3.4)가 박스 안에 온전히 들어오게 한다 → 카메라가 글로우 가장자리를
// 사각으로 자르지 않는다. 배치(absolute 등)는 호출부가 정한다.
import { cn } from '@/shared/lib'
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
  /** 영역(정사각) 픽셀 크기. 별 코어는 이 값의 ~52%, 글로우가 나머지를 채운다. */
  size?: number
  className?: string
}

export function ThemedStar({
  concept,
  color,
  seed = 7,
  brightness = 1,
  active = false,
  size = 360,
  className,
}: ThemedStarProps) {
  return (
    <div className={cn('aspect-square', className)} style={{ width: size, maxWidth: '88vw' }} aria-hidden>
      <StarCanvas width={160} height={160} animated className="h-full w-full">
        <Star3D concept={concept} color={color} seed={seed} brightness={brightness} active={active} x={80} y={80} r={42} />
      </StarCanvas>
    </div>
  )
}
