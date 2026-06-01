import { QueryClient } from '@tanstack/react-query'

/**
 * 앱 전역 단일 QueryClient. (app 레이어 소유)
 * 추후 Connect RPC 도입 시 connect-query가 이 위에 얹힌다(spec 02).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
