// 공급자 카드 ×5(spec 34): 키 상태 배지·키 입력/삭제/테스트·모델 리스트 편집.
// 키 입력값은 submit/테스트 직후 즉시 클리어한다 — 평문 키를 화면·상태에 남기지 않는다(1.2).
import { useState } from 'react'
import { errorMessage } from '@/shared/lib'
import { GlassCard, ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import type { ProviderConfig } from '@/shared/api'
import {
  useDeleteProviderKey,
  useSetProviderKey,
  useTestProviderKey,
  useUpdateProviderModels,
} from '../api/admin-queries'

export function ProviderCard({ provider }: { provider: ProviderConfig }) {
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState('')
  const setKey = useSetProviderKey()
  const deleteKey = useDeleteProviderKey()
  const testKey = useTestProviderKey()
  const updateModels = useUpdateProviderModels()

  const saveKey = () => {
    const apiKey = keyInput.trim()
    if (!apiKey) return
    setKey.mutate(
      { provider: provider.provider, apiKey },
      { onSuccess: () => setKeyInput('') }, // 평문은 즉시 화면에서 제거
    )
  }

  // 저장 전 입력 중인 키도 검증 가능(빈 입력이면 저장된 키로 테스트 — 2.4).
  const runTest = () => {
    testKey.mutate({ provider: provider.provider, model: '', apiKey: keyInput.trim() })
  }

  const addModel = () => {
    const m = modelInput.trim()
    if (!m || provider.models.includes(m)) return
    updateModels.mutate(
      { provider: provider.provider, models: [...provider.models, m] },
      { onSuccess: () => setModelInput('') },
    )
  }

  const removeModel = (m: string) => {
    updateModels.mutate({
      provider: provider.provider,
      models: provider.models.filter((x) => x !== m),
    })
  }

  const mutationError =
    (setKey.isError && setKey.error) ||
    (deleteKey.isError && deleteKey.error) ||
    (updateModels.isError && updateModels.error) ||
    null

  return (
    <GlassCard className="space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium tracking-wide text-white/90">{provider.provider}</h3>
        <span className="text-xs text-white/35">기본 {provider.defaultModel}</span>
        {provider.keySet ? (
          <span className="ml-auto rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-0.5 text-[11px] text-emerald-200/90">
            키 저장됨 ····{provider.keyLast4}
            {provider.keyUpdatedAt && (
              <span className="text-emerald-200/50"> · {provider.keyUpdatedAt.slice(0, 10)}</span>
            )}
          </span>
        ) : (
          <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/40">
            키 없음
          </span>
        )}
      </header>

      {/* 키 입력/저장/삭제/테스트 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-white/30"
          placeholder={provider.keySet ? '새 키로 교체…' : 'API 키 입력…'}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className={`${primaryButtonCls} disabled:opacity-40`}
            disabled={!keyInput.trim() || setKey.isPending}
            onClick={saveKey}
          >
            {setKey.isPending ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            className={`${ghostButtonCls} disabled:opacity-40`}
            disabled={testKey.isPending || (!keyInput.trim() && !provider.keySet)}
            onClick={runTest}
            title={keyInput.trim() ? '입력 중인 키 테스트' : '저장된 키 테스트'}
          >
            {testKey.isPending ? '테스트 중…' : '테스트'}
          </button>
          {provider.keySet && (
            <button
              type="button"
              className={`${ghostButtonCls} text-red-300/80 disabled:opacity-40`}
              disabled={deleteKey.isPending}
              onClick={() => deleteKey.mutate({ provider: provider.provider })}
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {testKey.data && (
        <p className={`text-xs ${testKey.data.ok ? 'text-emerald-300/80' : 'text-red-300'}`}>
          {testKey.data.ok
            ? `✓ 키 유효 (${testKey.data.latencyMs}ms)`
            : `✗ 실패: ${testKey.data.message}`}
        </p>
      )}
      {testKey.isError && <p className="text-xs text-red-300">⚠ {errorMessage(testKey.error)}</p>}
      {mutationError && <p className="text-xs text-red-300">⚠ {errorMessage(mutationError)}</p>}

      {/* 모델 리스트 편집 */}
      <div className="space-y-2">
        <p className="text-xs text-white/45">추가 모델 (활성 선택의 후보가 돼요)</p>
        <div className="flex flex-wrap gap-1.5">
          {provider.models.length === 0 && (
            <span className="text-xs text-white/25">기본 모델만 사용 중</span>
          )}
          {provider.models.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70"
            >
              {m}
              <button
                type="button"
                className="text-white/35 transition hover:text-red-300"
                onClick={() => removeModel(m)}
                aria-label={`${m} 제거`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 outline-none placeholder:text-white/25 focus:border-white/30"
            placeholder="모델명 추가 (예: gpt-5.4)"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addModel()
            }}
          />
          <button
            type="button"
            className={`${ghostButtonCls} px-3 py-1.5 text-xs disabled:opacity-40`}
            disabled={!modelInput.trim() || updateModels.isPending}
            onClick={addModel}
          >
            추가
          </button>
        </div>
      </div>
    </GlassCard>
  )
}
