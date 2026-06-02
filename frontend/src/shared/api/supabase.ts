import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// publishable key = 예전 anon key의 새 이름 (sb_publishable_…). 둘 다 공개 클라이언트 키.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  // 부팅 시 즉시 실패시켜, 키 누락이 무한 로딩이 아니라 명확한 원인으로 드러나게 한다 (수용 1.6).
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 가 설정되지 않았습니다. .env 를 확인하세요.',
  )
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true, // 새로고침 후 세션 유지 (1.5)
    autoRefreshToken: true,
    detectSessionInUrl: true, // OAuth(Google 슬롯인) redirect 복귀용 — OTP 코드 흐름엔 미사용, 무해
  },
})

/** 02의 Connect transport 인터셉터가 await 해서 Authorization 헤더에 싣는 토큰 getter (1.3). */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
