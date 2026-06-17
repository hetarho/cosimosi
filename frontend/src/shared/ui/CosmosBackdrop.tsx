import { type CSSProperties } from 'react'
import { cn } from '@/shared/lib'
import { StarFieldCanvas } from './StarFieldCanvas'
import { GrainOverlay } from './GrainOverlay'
import { FluidGradient } from './FluidGradient'

interface CosmosBackdropProps {
  className?: string
  /** 별 개수(밀도). 기본값은 사인인·초대 화면에 알맞은 차분한 밀도. */
  starCount?: number
  /**
   * 필름 그레인 세기(0~1). 이 값이 `--ld-grain-opacity`를 **인라인으로** 세팅하므로 grain의
   * 실효 노브는 여기다(CSS/values에서 바꾼 토큰은 이 인라인이 덮어써서 효과가 없다). 디더(overlay)
   * 레이어는 이 값에서 파생한다(전면적으로 보이는 질감).
   */
  grainOpacity?: number
}

/**
 * 랜딩(spec 15)과 같은 세계로 보이는 공유 우주 배경 — 사인인(`/sign-in`)·초대(`/invite`, spec 41)가
 * 같은 첫인상을 입도록 끌어올린 백드롭. 절차적 **fluid 메시 그라디언트**(R3F/WebGPU·TSL fbm — 불규칙하게
 * 흐르는 오로라, 원형 없음) 위에 반짝이는 별 필드 + 필름 그레인을 얹는다. WebGPU 초기화 전에는 CSS 베이스
 * 그라디언트가 폴백색. `prefers-reduced-motion`이면 그라디언트·트윙클이 멎는다. `fixed inset-0 -z-10`.
 */
export function CosmosBackdrop({ className, starCount = 90, grainOpacity = 0.3 }: CosmosBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
      // grain(screen, 어두운 영역에 밝은 알갱이) + deband(overlay, 밝은 영역까지 전면 질감)를 함께 올려
      // 또렷한 필름 그레인 느낌을 준다. 인라인이라 이 값이 실효 — CSS/values 토큰을 덮어쓴다.
      style={
        {
          '--ld-grain-opacity': grainOpacity,
          '--ld-deband-opacity': Math.min(grainOpacity * 2, 0.85),
        } as CSSProperties
      }
    >
      {/* WebGPU 초기화 전 깜빡임 폴백 베이스색(FluidGradient가 뜨면 그 위를 덮는다). */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 120% at 50% -10%, #171833 0%, #0b0b1c 45%, #050510 100%)' }}
      />
      {/* 불규칙하게 흐르는 메시 그라디언트(WebGPU/TSL). reduced-motion이면 정적. */}
      <FluidGradient />
      <StarFieldCanvas count={starCount} maxAlpha={0.7} parallax={14} className="absolute inset-0 h-full w-full" />
      <GrainOverlay />
    </div>
  )
}
