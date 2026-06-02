export { App } from './App'
// 진짜 글로벌 상태인 세션은 app 레이어가 소유한다(§2.7). 다른 레이어가 세션을 읽을 공개 진입점.
export { useAuthStore } from './model/auth-store'
