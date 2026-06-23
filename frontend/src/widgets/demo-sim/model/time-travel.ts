// 시간 머신 오케스트레이션(spec 19, change 24). 체험 우주의 가상 시계를 배속으로 흘려보내며 화면을
// 새 now로 계속 다시 굽는다. 데이터(타임스탬프)는 그대로라 밝기·반지름은 refetch가 아니라 스토어
// 재파생(refreshActivation)이 맞고, 그건 매 프레임 setStars를 피하려 호출자(pages 드라이버)가 throttle한다.
// 여기 tickDemoClock은 한 프레임어치 가상 시간을 누적하고, 지나친 04:00 경계마다 야간 공고화를 1회씩
// 발화해 그 밤에만 우주·잠든 별 쿼리를 무효화한다. model 계층: three/React/DOM 미의존(헌법 §4 — rAF는 호출자).
import type { QueryClient } from '@tanstack/react-query'
import {
  advanceDemoClock,
  advanceDemoGenesis,
  demoConsolidate,
  enterDemoMode,
  exitDemoMode,
  getDemoFlow,
  getDemoPersona,
  getTutorialStep,
  resetDemo,
  setDemoFlow,
  setDemoPersona,
  setTutorialStep,
  type DemoPersona,
} from '@/shared/lib/demo'
import { dormantInvalidateKey, universeInvalidateKey } from '@/entities/memory'

/** 배속 흐름 한 틱: 경과 실시간(ms)을 배속만큼 가상 시간으로 누적하고, 지나친 simulated 04:00 KST
 *  경계마다 야간 공고화를 1회씩 발화한다(production change 20 데모 대응 — 패스 동치는 job 43이 마저).
 *  공고화로 데이터가 바뀐 밤에만 우주·잠든 별 쿼리를 무효화한다(밝기·반지름의 연속 재파생은 호출자가
 *  refreshActivation throttle로 — 매 프레임 refetch 금지, 헌법8). 이 틱이 지난 경계 수를 돌려준다. */
export function tickDemoClock(queryClient: QueryClient, realElapsedMs: number): number {
  const boundaries = advanceDemoClock(realElapsedMs)
  if (boundaries > 0) {
    // 경계(밤)마다: ① genesis가 켜져 있으면 그 날 일기/회상을 production 엔진으로 빚고(change 28),
    // ② 그 밤의 야간 공고화를 발화한다 — 막 태어난 별이 같은 밤 공고화를 함께 탄다. genesis 비활성
    // (튜토리얼·30일 종료 후·실계정 시간흐름)이면 ①은 무동작이고 ②만 돈다(기존 동작 보존).
    for (let i = 0; i < boundaries; i++) {
      advanceDemoGenesis()
      demoConsolidate()
    }
    void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
    void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
  }
  return boundaries
}

/** "처음으로": 체험의 휘발성 상태를 즉시 다시 들어오는 결과와 동일한 경로로 초기화한다.
 *  진입 흐름(free·tutorial)과 튜토리얼 step을 보존한다 — exit/enter는 데이터 출처 리셋(캐시·스토어
 *  비우기)을 위한 것이지 온보딩/튜토리얼 진행을 되돌리는 게 아니다(plan 47·48: 처음으로/페르소나
 *  전환은 모드·진행을 유지). exitDemoMode가 flow·step을 비우므로 캡처 후 복원한다. */
export function resetDemoExperience(): void {
  const flow = getDemoFlow()
  const step = getTutorialStep()
  exitDemoMode()
  resetDemo()
  enterDemoMode()
  setDemoFlow(flow)
  setTutorialStep(step)
}

/** 페르소나 전환 시 우주의 주인공(데이터 출처)을 바꾼다. 전환은 "처음으로"와 같은 리셋
 *  경로를 밟아 추가 별과 가상 시계를 정리한다. */
export function switchDemoPersona(id: DemoPersona): void {
  if (id === getDemoPersona()) return
  setDemoPersona(id)
  resetDemoExperience()
}
