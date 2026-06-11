// 이론별 미니 비주얼(spec 19) — 랜딩 카드와 같은 시각 언어(VizStar/VizSynapse, mood 색,
// 전역 오브제 형태)를 entities로 내려 데모의 이론 안내 모달에서도 보여준다(FSD: 위젯은
// pages를 import할 수 없으므로 공유 비주얼은 entity 레이어가 맞다). 교차 entity는 @x로만.
// 각 장면은 카드 시연의 축약본 — 상호작용 없는 한 컷(설명은 모달 텍스트가 담당).
import { MOOD } from '@/shared/config'
import { useAppearance } from '@/entities/appearance/@x/theory'
import { VizStar, type StarObject } from '@/entities/star/@x/theory'
import { VizSynapse } from '@/entities/synapse/@x/theory'

const VIOLET = MOOD.violet
const TEAL = MOOD.teal
const AMBER = MOOD.amber
const CORAL = MOOD.coral

function Scene({ id, concept }: { id: string; concept: StarObject }) {
  switch (id) {
    case 'engram': {
      // 뉴런 다발 → 시냅스 → 별 매핑(EngramCard 축약).
      const dendrites = ['M40 40 L14 22', 'M40 40 L10 42', 'M40 40 L18 62', 'M40 40 L38 12']
      return (
        <>
          {dendrites.map((d) => (
            <path key={d} d={d} stroke={VIOLET} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.5} />
          ))}
          <circle cx={40} cy={40} r={11} fill={VIOLET} fillOpacity={0.22} />
          <circle cx={40} cy={40} r={6} fill={VIOLET} fillOpacity={0.85} />
          <VizSynapse x1={66} y1={40} x2={130} y2={40} color={VIOLET} strength={0.85} arc={0.06} active concept={concept} />
          <VizStar cx={160} cy={40} r={17} color={VIOLET} concept={concept} seed={7} active />
        </>
      )
    }
    case 'synapse':
      // 새 별이 같은 날(temporal)·비슷한 의미(semantic)의 별과 이어진다.
      return (
        <>
          <VizSynapse x1={100} y1={28} x2={42} y2={54} color={AMBER} strength={0.8} arc={0.14} active concept={concept} />
          <VizSynapse x1={100} y1={28} x2={158} y2={54} color={AMBER} strength={0.6} arc={-0.14} active concept={concept} />
          <VizStar cx={100} cy={28} r={12} color={AMBER} concept={concept} seed={31} active />
          <VizStar cx={42} cy={54} r={9} color={AMBER} concept={concept} seed={71} brightness={0.8} />
          <VizStar cx={158} cy={54} r={9} color={AMBER} concept={concept} seed={42} brightness={0.8} />
        </>
      )
    case 'hebbian':
      // 함께 회상한 두 별 — 사이 연결이 굵고 또렷하다.
      return (
        <>
          <VizSynapse x1={48} y1={40} x2={152} y2={40} color={TEAL} strength={0.95} arc={0.16} active concept={concept} />
          <VizStar cx={48} cy={40} r={14} color={TEAL} concept={concept} seed={101} active />
          <VizStar cx={152} cy={40} r={14} color={TEAL} concept={concept} seed={202} active />
        </>
      )
    case 'active-recall':
      // 스침(<2초)은 아무것도 바꾸지 않는다 — 연결이 옅은 채 그대로.
      return (
        <>
          <VizSynapse x1={48} y1={40} x2={152} y2={40} color={TEAL} strength={0.18} arc={0.16} concept={concept} />
          <VizStar cx={48} cy={40} r={14} color={TEAL} concept={concept} seed={101} brightness={0.7} />
          <VizStar cx={152} cy={40} r={14} color={TEAL} concept={concept} seed={202} brightness={0.7} />
        </>
      )
    case 'decay':
      // 방금 회상한 별 vs 오래 둔 별 — 어두워질 뿐 꺼지지 않는다(바닥 5%).
      return (
        <>
          <VizStar cx={55} cy={40} r={16} color={CORAL} concept={concept} seed={107} brightness={1} active />
          <VizStar cx={145} cy={40} r={16} color={CORAL} concept={concept} seed={233} brightness={0.12} />
        </>
      )
    case 'dormant':
      // 잠든 별 — 어둡지만 연결을 품은 채 남아, 회상 한 번이면 다시 깨어난다.
      return (
        <>
          <VizSynapse x1={70} y1={40} x2={150} y2={48} color={CORAL} strength={0.3} arc={0.12} concept={concept} />
          <VizStar cx={70} cy={40} r={16} color={CORAL} concept={concept} seed={233} brightness={0.1} />
          <VizStar cx={150} cy={48} r={9} color={CORAL} concept={concept} seed={88} brightness={0.6} />
        </>
      )
    default:
      return null
  }
}

/** 이론 id → 미니 비주얼 한 컷. 모르는 id(20–27이 아직 비주얼을 안 단 항목)는 그리지 않는다. */
export function TheoryViz({ id, className }: { id: string; className?: string }) {
  const concept = useAppearance((s) => s.object)
  return (
    <div className={`rounded-xl border border-white/10 bg-space-900/40 ${className ?? ''}`}>
      <svg viewBox="0 0 200 80" className="h-28 w-full" aria-hidden>
        <Scene id={id} concept={concept} />
      </svg>
    </div>
  )
}
