import { GlassCard } from '@/shared/ui'
import { EngramDemo } from '@/entities/theory'
import { TheoryBadge } from './TheoryBadge'
import { TryInUniverse } from './TryInUniverse'

/**
 * ENGRAM 카드 — 시연 본체는 entities/theory의 EngramDemo(데모 모달과 공유, spec 19).
 * 랜딩은 카드 크롬(GlassCard)과 상태 배지·"이 카드 체험하기"만 얹는다.
 */
export function EngramCard() {
  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <EngramDemo />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TheoryBadge status="done" plan="08·11" />
        <TryInUniverse sim="engram" />
      </div>
    </GlassCard>
  )
}
