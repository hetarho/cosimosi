// 시간 머신 오케스트레이션(spec 19). 체험 우주의 가상 시계를 전진시킨 뒤 화면을 새 now로
// 다시 굽는다. 데이터(타임스탬프)는 그대로라 refetch가 아니라 스토어 재파생이 맞다.
// 시간 이동은 하루 단위 배치를 조용히 적용한 뒤 캔버스가 정착 좌표를 보여주는 식으로 끝낸다.
// 중간 트윈은 만들지 않는다(스프링식 요동 방지). model 계층: three/React/DOM 미의존(헌법 §4).
import type { QueryClient } from '@tanstack/react-query'
import {
  demoApplyDayBatch,
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
import { dormantInvalidateKey, refreshActivation, universeInvalidateKey } from '@/entities/memory'

/** "하루/한 달 지나기": 하루 단위 배치(시계 +1일 → 야간 공고화)를 반복 적용한다.
 *  실제 감쇠 수식(activation)이 그대로 돌므로 시간이 진짜 흐른 것과 동일한 결과다. */
export function runTimeSkip(queryClient: QueryClient, days: number, onSettled?: () => void): void {
  const applied = demoApplyDayBatch(days)
  if (applied === 0) return
  refreshActivation()
  void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
  void queryClient.invalidateQueries({ queryKey: dormantInvalidateKey() })
  onSettled?.()
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
