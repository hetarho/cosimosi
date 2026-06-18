import { GlassCard } from '@/shared/ui'
import { HebbianDemo } from '@/entities/theory'
import { TheoryBadge } from './TheoryBadge'
import { TryInUniverse } from './TryInUniverse'

/**
 * 헵 가소성 카드 — 시연 본체는 entities/theory의 HebbianDemo(데모 모달과 공유, spec 19).
 * 랜딩은 카드 크롬(GlassCard)과 상태 배지·"체험 우주에서 해보기"만 얹는다.
 */
export function HebbianCard() {
  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <HebbianDemo />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TheoryBadge status="done" plan="11" />
        <TryInUniverse sim="hebbian" />
      </div>
    </GlassCard>
  )
}
