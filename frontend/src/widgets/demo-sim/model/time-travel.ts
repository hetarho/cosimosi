// 시간 머신 오케스트레이션(spec 19). 가상 시계를 전진시킨 뒤 화면을 새 now로 다시
// 굽는다 — 데이터(타임스탬프)는 그대로라 refetch가 아니라 스토어 재파생이 맞다.
// 스킵은 한 번에 점프하지 않고 **짧은 트윈(~0.9s, ease-in-out)** 으로 시계를 흘려보내
// 밝기가 뚝 끊기지 않고 서서히 저무는 것처럼 보이게 한다(사용자 피드백). 틱마다
// 재파생(setStars/setEdges)이 돌지만 데모 우주 규모(별 ~30·엣지 ~30)에서만 쓰인다.
// model 계층: three/React/DOM 미의존(헌법 §4); zustand·QueryClient·타이머는 RN-safe.
import type { QueryClient } from '@tanstack/react-query'
import { enterDemoMode, exitDemoMode, resetDemo, skipDemoDays } from '@/shared/lib/demo'
import { dormantInvalidateKey, refreshActivation } from '@/entities/memory'

const SKIP_TWEEN_MS = 900
const SKIP_TICK_MS = 75

const easeInOut = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

interface ActiveSkip {
  /** 트윈 중단. applyRemainder=true면 잔여 일수를 즉시 적용(연타 합산용). */
  cancel: (applyRemainder: boolean) => void
}

let active: ActiveSkip | null = null

/** "하루/한 달 지나기": 시계를 트윈으로 전진 → 틱마다 별·엣지 밝기 재파생 → 잠든 별 갱신.
 *  실제 감쇠 수식(activation)이 그대로 돌므로 시간이 진짜 흐른 것과 동일한 결과다. */
export function runTimeSkip(queryClient: QueryClient, days: number): void {
  active?.cancel(true) // 연타: 이전 스킵의 잔여분을 즉시 적용하고 새 스킵을 시작(합산)
  const start = Date.now()
  let applied = 0
  const finishDormant = () => void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })

  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / SKIP_TWEEN_MS)
    const want = days * easeInOut(p)
    if (want > applied) {
      skipDemoDays(want - applied)
      applied = want
      refreshActivation()
    }
    if (p >= 1) {
      clearInterval(timer)
      active = null
      finishDormant()
    }
  }
  const timer = setInterval(tick, SKIP_TICK_MS)
  active = {
    cancel: (applyRemainder) => {
      clearInterval(timer)
      active = null
      if (applyRemainder && applied < days) {
        skipDemoDays(days - applied)
        refreshActivation()
      }
      finishDormant()
    },
  }
  tick() // 누르자마자 첫 반응(인터벌 첫 발화를 기다리지 않는다)
}

/** "처음으로": 체험을 나갔다 즉시 다시 들어오는 것과 동일한 경로 — 모드 리스너(앱의
 *  reset-universe-data)가 캐시·스토어를 비우고, 다음 GetUniverse가 base 우주를 재시드한다.
 *  resetDemo가 추가 별·엣지·가상 시계를 함께 정리한다(랜딩 tryDemo와 같은 검증된 경로). */
export function resetDemoExperience(): void {
  // 진행 중인 스킵 트윈을 중단(잔여 미적용 — 시계가 곧 0으로 리셋되므로 의미 없다).
  // 중단하지 않으면 리셋 후에도 인터벌이 offset을 계속 키우는 사고가 난다.
  active?.cancel(false)
  exitDemoMode()
  resetDemo()
  enterDemoMode()
}
