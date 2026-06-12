// 활성 추출 LLM 선택 카드(spec 34): 공급자·모델 셀렉트 + 저장(SetActiveLLM).
// 모델 후보 = 그 공급자의 기본 모델 ∪ 관리자 추가 모델("" = 기본). 저장 후 ≤30s 내
// 백엔드 Resolver가 무재시작으로 새 선택을 사용한다.
import { useState } from 'react'
import { errorMessage } from '@/shared/lib'
import { GlassCard, primaryButtonCls } from '@/shared/ui'
import type { GetLLMConfigResponse } from '@/shared/api'
import { useSetActiveLLM } from '../api/admin-queries'

export function ActiveLLMCard({ config }: { config: GetLLMConfigResponse }) {
  // 편집 중인 선택만 로컬 상태로 — null이면 서버 값을 그대로 비춘다(effect 재시드 불필요:
  // 저장 성공 → invalidate → 새 서버 값 위에 edited=null로 복귀).
  const [edited, setEdited] = useState<{ provider: string; model: string } | null>(null)
  const setActive = useSetActiveLLM()

  const provider = edited?.provider ?? config.activeProvider
  const model = edited?.model ?? config.activeModel

  const card = config.providers.find((p) => p.provider === provider)
  const models = card ? [card.defaultModel, ...card.models.filter((m) => m !== card.defaultModel)] : []
  const dirty = provider !== config.activeProvider || model !== config.activeModel

  return (
    <GlassCard className="space-y-4 p-6">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-light tracking-wide">활성 추출 LLM</h2>
        <span className="text-xs text-white/35">저장 후 30초 내 무재시작 반영</span>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 space-y-1 text-xs text-white/45">
          공급자
          <select
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/30"
            value={provider}
            onChange={(e) => setEdited({ provider: e.target.value, model: '' })} // 공급자 변경 시 모델은 기본으로
          >
            {config.providers.map((p) => (
              <option key={p.provider} value={p.provider} className="bg-[#0a0a18]">
                {p.provider}
                {p.keySet ? '' : ' (키 없음)'}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1 space-y-1 text-xs text-white/45">
          모델
          <select
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 outline-none focus:border-white/30"
            value={model}
            onChange={(e) => setEdited({ provider, model: e.target.value })}
          >
            <option value="" className="bg-[#0a0a18]">
              기본 ({card?.defaultModel ?? '—'})
            </option>
            {models.map((m) => (
              <option key={m} value={m} className="bg-[#0a0a18]">
                {m}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`${primaryButtonCls} self-end disabled:opacity-40`}
          disabled={!dirty || setActive.isPending}
          onClick={() =>
            setActive.mutate({ provider, model }, { onSuccess: () => setEdited(null) })
          }
        >
          {setActive.isPending ? '저장 중…' : '저장'}
        </button>
      </div>

      {card && !card.keySet && (
        <p className="text-xs text-amber-300/80">
          ⚠ 이 공급자는 저장된 키가 없어요 — 아래 카드에서 키를 넣지 않으면 env 키로 폴백돼요.
        </p>
      )}
      {setActive.isError && (
        <p className="text-xs text-red-300">⚠ {errorMessage(setActive.error)}</p>
      )}
      {setActive.isSuccess && !dirty && (
        <p className="text-xs text-emerald-300/80">저장됨 — 다음 추출부터 적용돼요.</p>
      )}
    </GlassCard>
  )
}
