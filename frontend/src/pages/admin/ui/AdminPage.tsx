// 관리자 콘솔 /admin (spec 34): 활성 LLM 선택 + 공급자 5카드 + 운영 대시보드.
// 비관리자는 첫 쿼리의 PermissionDenied를 받고 NotFound 화면을 본다(3.3) —
// admin 표면의 존재를 광고하지 않는다(콘솔 에러도 없음: 정상 처리된 쿼리 에러다).
import { useQuery } from '@tanstack/react-query'
import { GlassCard, NotFoundScreen } from '@/shared/ui'
import { isPermissionDenied, llmConfigQueryOptions } from '../api/admin-queries'
import { ActiveLLMCard } from './ActiveLLMCard'
import { ErrorNotice } from './ErrorNotice'
import { ProviderCard } from './ProviderCard'
import { OverviewSection } from './OverviewSection'

export function AdminPage() {
  const { data, isPending, isError, error, refetch } = useQuery(llmConfigQueryOptions())

  if (isError && isPermissionDenied(error)) return <NotFoundScreen />

  return (
    <div className="min-h-screen bg-[#050510] px-6 py-10 text-white/90">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-light tracking-wide">관리자 콘솔</h1>
          <p className="text-sm text-white/45">
            LLM 공급자·키 운영과 서비스 현황. 키는 서버에서 암호화되어 다시 표시되지 않아요.
          </p>
        </header>

        {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}

        {isError && !isPermissionDenied(error) && (
          <ErrorNotice error={error} onRetry={() => void refetch()} />
        )}

        {data && (
          <>
            {!data.encryptionReady && (
              <GlassCard className="border border-amber-300/20 p-4">
                <p className="text-sm text-amber-200/90">
                  서버에 <code className="text-amber-100">LLM_KEY_ENCRYPTION_KEY</code>가 설정되지
                  않아 키 저장이 막혀 있어요.
                </p>
                <p className="mt-1 text-xs text-amber-200/50">
                  <code>openssl rand -base64 32</code>로 생성해 서버 env에 넣고 재시작하세요.
                </p>
              </GlassCard>
            )}

            <ActiveLLMCard config={data} />

            <section className="space-y-3">
              <h2 className="text-base font-light tracking-wide">공급자</h2>
              <div className="space-y-3">
                {data.providers.map((p) => (
                  <ProviderCard key={p.provider} provider={p} />
                ))}
              </div>
            </section>

            <OverviewSection />
          </>
        )}
      </div>
    </div>
  )
}
