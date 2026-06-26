// 개발용 TanStack devtools(Router·Query 플로팅 패널)는 현재 꺼둔다(요청). 다시 켜려면 DEV 게이트 +
// Suspense 안에 @tanstack/react-router-devtools의 TanStackRouterDevtools, @tanstack/react-query-devtools의
// ReactQueryDevtools를 lazy 마운트한다(프로덕션 번들 미포함 유지). RootLayout은 이 no-op을 그대로 렌더한다.
export function DevTools() {
  return null
}
