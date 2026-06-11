import { GlassCard } from '@/shared/ui'
import { SilentEngramDemo } from '@/entities/theory'
import { TheoryBadge } from './TheoryBadge'
import { TryInUniverse } from './TryInUniverse'

/**
 * 침묵 엔그램 카드 — 시연 본체는 entities/theory의 SilentEngramDemo(데모 모달과 공유,
 * spec 19). 랜딩은 카드 크롬(GlassCard)과 상태 배지·"이 카드 체험하기"만 얹는다.
 */
export function SilentEngramCard() {
  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <SilentEngramDemo />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TheoryBadge status="done" plan="12" />
        <TryInUniverse sim="dormant" />
      </div>
    </GlassCard>
  )
}
