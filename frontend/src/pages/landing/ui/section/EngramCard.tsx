import { GlassCard } from '@/shared/ui'
import { EngramDemo } from '@/entities/theory'
import { TheoryBadge } from './TheoryBadge'
import { TryInUniverse } from './TryInUniverse'

/**
 * ENGRAM 카드 — 시연 본체는 entities/theory의 EngramDemo(데모 모달과 공유, spec 19).
 * 랜딩은 카드 크롬(GlassCard)과 상태 배지·"이 카드 체험하기"만 얹는다.
 *
 * 카피 점검(spec 20 T013): 현재 카피는 뉴런↔별 매핑까지만 말하고 "하루의 여러
 * 감정이 사건 경계로 나뉘어 여러 별이 된다"(분절)는 메시지가 없다. 추출기(20)는
 * 백엔드 토대만이므로 여기선 기록만 — 1 일기→N 별 시각화·카피 보강은 spec 21에서.
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
