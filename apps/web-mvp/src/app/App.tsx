import { useEffect } from 'react'
import { TransportProvider } from '@connectrpc/connect-query'
import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { transport } from '@/shared/api'
import { setDemoModeListener } from '@/shared/lib/demo'
import { composeActor, scheduleSynapseSync } from '@/features/record-memory'
import { universeInvalidateKey, recordsInvalidateKey } from '@/entities/memory'
import { resetUniverseData } from './model/reset-universe-data'
import { queryClient } from './query-client'
import { router } from './router'
import { GlobalErrorScreen } from './ui/ErrorScreens'
import { SessionContext } from './ui/session-context'

export function App() {
  // 체험 enter/exit = 데이터 출처 전환 → 캐시·스토어 리셋 주입(shared는 app을 모름 — 16).
  // (세션 복원·인증 구독은 세션 머신이 invoke로 소유 — SessionContext.Provider가 마운트 시 시작.)
  useEffect(() => {
    setDemoModeListener(resetUniverseData)
    return () => setDemoModeListener(null)
  }, [])

  // 별 띄우기 성공(compose 머신 'submitted') → 우주·일기목록 무효화 + 시냅스 지연 refetch. App 루트에
  // 두어 라우트 이동/HomePage 언마운트와 무관하게 항상 동작한다(머신은 순수·앱 queryClient는 여기 단일
  // 출처). composeActor는 모듈 싱글턴이라 제출 invoke가 페이지 언마운트 뒤에도 완주해 emit한다.
  useEffect(() => {
    const sub = composeActor.on('submitted', () => {
      void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
      void queryClient.invalidateQueries({ queryKey: recordsInvalidateKey() })
      scheduleSynapseSync(queryClient)
    })
    return () => sub.unsubscribe()
  }, [])

  // 전역 바운더리(17): 라우터 폴백조차 못 그린 크래시의 마지막 그물. Sentry init이 안 된
  // 환경(로컬 DSN 없음)에서도 폴백 렌더는 정상 — 캡처만 no-op이라 DSN 유무로 분기하지 않는다.
  // TransportProvider가 QueryClientProvider 바깥(connect-query v2 문서 순서) — 쿼리 키가
  // 참조하는 transport는 shared/api의 단일 인스턴스(인증 인터셉터·keepalive 유지, 16).
  // SessionContext.Provider가 라우터를 감싼다 — 보호 라우트의 SessionGate가 머신을 구독.
  return (
    <Sentry.ErrorBoundary fallback={GlobalErrorScreen}>
      <TransportProvider transport={transport}>
        <QueryClientProvider client={queryClient}>
          <SessionContext.Provider>
            <RouterProvider router={router} />
          </SessionContext.Provider>
        </QueryClientProvider>
      </TransportProvider>
    </Sentry.ErrorBoundary>
  )
}
