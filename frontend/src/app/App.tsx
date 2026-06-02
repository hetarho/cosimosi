import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useAuthStore } from './model/auth-store'
import { queryClient } from './query-client'
import { router } from './router'

export function App() {
  // 부팅 시 세션 복원 + 변경 구독을 1회 시작. init()이 구독 해제 함수를 반환하므로 StrictMode 안전.
  useEffect(() => useAuthStore.getState().init(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
