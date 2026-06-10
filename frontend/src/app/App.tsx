import { useEffect } from 'react'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { transport } from '@/shared/api'
import { setDemoModeListener } from '@/shared/lib/demo'
import { useAuthStore } from './model/auth-store'
import { resetUniverseData } from './model/reset-universe-data'
import { queryClient } from './query-client'
import { router } from './router'

export function App() {
  // 부팅 시 세션 복원 + 변경 구독을 1회 시작. init()이 구독 해제 함수를 반환하므로 StrictMode 안전.
  useEffect(() => useAuthStore.getState().init(), [])
  // 체험 enter/exit = 데이터 출처 전환 → 캐시·스토어 리셋 주입(shared는 app을 모름 — 16).
  useEffect(() => {
    setDemoModeListener(resetUniverseData)
    return () => setDemoModeListener(null)
  }, [])

  // TransportProvider가 QueryClientProvider 바깥(connect-query v2 문서 순서) — 쿼리 키가
  // 참조하는 transport는 shared/api의 단일 인스턴스(인증 인터셉터·keepalive 유지, 16).
  return (
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </TransportProvider>
  )
}
