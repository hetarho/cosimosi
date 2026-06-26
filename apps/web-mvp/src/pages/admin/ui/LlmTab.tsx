// LLM 관리 탭(spec 34) — 활성 LLM 선택 + 공급자 5카드 + 운영 대시보드. 기존 AdminPage 본문을
// 그대로 옮긴 것(동작 불변·회귀 0). 권한 게이트(PermissionDenied→NotFound)는 셸(AdminPage)이 한다.
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/shared/ui'
import { llmConfigQueryOptions } from '../api/admin-queries'
import { ActiveLLMCard } from './ActiveLLMCard'
import { ErrorNotice } from './ErrorNotice'
import { ProviderCard } from './ProviderCard'
import { OverviewSection } from './OverviewSection'

export function LlmTab() {
  const { data, isPending, isError, error, refetch } = useQuery(llmConfigQueryOptions())

  return (
    <div className="space-y-6">
      {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}

      {/* 권한 거부는 셸(AdminPage)이 NotFound로 가르므로 여기 도달하는 에러는 일반 실패뿐. */}
      {isError && <ErrorNotice error={error} onRetry={() => void refetch()} />}

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
  )
}
