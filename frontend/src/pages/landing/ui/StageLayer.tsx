import { useStage } from '../model/stage'
import { bandToAnchor } from '../lib/stage-projection'

/**
 * 무대 클릭 오버레이(change 31). 무대의 별·시냅스 자체는 배경 `CosmosScene`이 **진짜 3D 별 오브제**로 그린다
 * (LandingPage가 무대 상태를 주입). 그 캔버스는 `pointer-events-none`이라, 클릭 가능한 별(망각 무대 재점화)
 * 위에만 이 레이어가 투명한 접근성 버튼을 별의 화면 앵커에 정확히 겹쳐 깐다 — 나머지 영역 클릭은 콘텐츠로 통과한다.
 */
export function StageLayer() {
  const scene = useStage((s) => s.scene)
  const onStarClick = useStage((s) => s.onStarClick)
  const clickable = scene.stars.filter((s) => s.clickable)
  if (!onStarClick || clickable.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {clickable.map((s) => {
        const [ax, ay] = bandToAnchor(s.x, s.y)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onStarClick(s.id)}
            aria-label="어두워진 별 다시 떠올리기"
            className="pointer-events-auto absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ left: `${ax * 100}%`, top: `${ay * 100}%` }}
          />
        )
      })}
    </div>
  )
}
