// cosimosi 브랜드 로크업 — 우리 3D 별 오브제를 로고처럼 쓰고 그 위에 "cosimosi" 워드마크를 얹는다
// (랜딩 히어로의 엠블럼과 같은 결). 별 형태는 현재 오브제(appearance.object), 색은 테마 accent를 따른다.
// 사인인(`/sign-in`)·초대(`/invite`, spec 41)가 카드 없이 배경 위에 그대로 띄우는 공유 마크.
import { themeAccent, useAppearance } from '@/entities/appearance'
import { cn } from '@/shared/lib'
import { ThemedStar } from './ThemedStar'

export interface BrandMarkProps {
  /** 별 영역(정사각) 픽셀 크기 — 글로우 포함. */
  size?: number
  className?: string
}

export function BrandMark({ size = 220, className }: BrandMarkProps) {
  const object = useAppearance((s) => s.object)
  const accent = themeAccent(useAppearance((s) => s.theme))
  return (
    // 명시적 정사각 박스 — 별이 absolute라 박스에 width/height를 안 주면 폭이 0으로 접혀 중앙정렬이
    // 깨진다(우측 쏠림). 박스가 별의 실제 footprint를 예약해 아래 입력과도 안 겹친다.
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size, maxWidth: '88vw' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <ThemedStar concept={object} color={accent} seed={7} size={size} />
      </div>
      {/* 워드마크는 박스 하단 가로 전체에 깔고 가운데 정렬 → 별 글로우 아래에 "cosimosi"가 중앙에. */}
      <span className="absolute inset-x-0 bottom-1 text-center text-sm uppercase tracking-[0.4em] text-white/85">
        cosimosi
      </span>
    </div>
  )
}
