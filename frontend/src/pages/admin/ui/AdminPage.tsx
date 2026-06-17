// 관리자 콘솔 /admin 셸(spec 34 + 41): "LLM 관리"·"초대 코드" 두 탭으로 가른다. 탭은 ?tab= 로
// 딥링크된다(기본 llm). 비관리자는 첫 쿼리의 PermissionDenied를 받고 NotFound 화면을 본다(3.3) —
// admin 표면의 존재를 광고하지 않는다(콘솔 에러도 없음). 권한 프로브는 LlmTab과 같은 쿼리 키라 디듑된다.
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { NotFoundScreen } from '@/shared/ui'
import { isPermissionDenied, llmConfigQueryOptions } from '../api/admin-queries'
import { LlmTab } from './LlmTab'
import { InviteCodesTab } from './InviteCodesTab'

const TABS = [
  { value: 'llm', label: 'LLM 관리' },
  { value: 'invite', label: '초대 코드' },
] as const

export function AdminPage() {
  const { tab } = useSearch({ from: '/admin' })
  const active = tab ?? 'llm'
  const navigate = useNavigate()
  // 권한 프로브 — 비관리자는 PermissionDenied → NotFound(표면 비노출). LlmTab과 같은 쿼리 키라 디듑.
  const gate = useQuery(llmConfigQueryOptions())
  if (gate.isError && isPermissionDenied(gate.error)) return <NotFoundScreen />

  return (
    <div className="min-h-screen bg-[#050510] px-6 py-10 text-white/90">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-light tracking-wide">관리자 콘솔</h1>
          <p className="text-sm text-white/45">LLM 운영과 초대 코드 관리.</p>
        </header>

        <div className="flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => void navigate({ to: '/admin', search: { tab: t.value } })}
              className={[
                'px-3 py-2 text-sm transition',
                active === t.value
                  ? 'border-b-2 border-indigo-400 text-white/90'
                  : 'text-white/45 hover:text-white/70',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {active === 'invite' ? <InviteCodesTab /> : <LlmTab />}
      </div>
    </div>
  )
}
