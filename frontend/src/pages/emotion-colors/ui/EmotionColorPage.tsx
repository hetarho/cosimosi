// 감정색 설정/편집 페이지(spec 45) — `/emotion-colors`. 13개 mood 색을 추천값으로 시작해 한 번에 저장하는
// 필수 설정이자, 이후 재방문해 수정하는 편집 페이지다. 마케팅·설명이 아니라 바로 쓰는 설정 도구로 연다.
// 저장 전까지 DB를 바꾸지 않고, 저장 성공 시 settings cache·store를 즉시 갱신한 뒤 redirect(없으면 `/`)로.
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MOOD_LABEL, type Mood } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  settingsQueryOptions,
  emotionColorsOf,
  mergeEmotionColorDraft,
  recommendedEmotionColors,
  saveEmotionColors,
  MOOD_ORDER,
} from '@/entities/appearance'
import { EmotionColorPicker } from '@/features/pick-emotion-colors'

export function EmotionColorPage() {
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/emotion-colors' })
  const queryClient = useQueryClient()
  const { data, isError, refetch } = useQuery(settingsQueryOptions())
  const recommended = useMemo(() => recommendedEmotionColors(), [])

  // draft는 설정 로드 직후 1회 시드(서버 색 우선, 없으면 추천색 — A4). 저장 전까지 로컬에만 산다.
  const [draft, setDraft] = useState<Record<Mood, string> | null>(null)
  const [selected, setSelected] = useState<Mood>(MOOD_ORDER[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (draft === null && data) setDraft(mergeEmotionColorDraft(emotionColorsOf(data)))

  const setColor = useCallback((mood: Mood, hex: string) => {
    setDraft((d) => (d ? { ...d, [mood]: hex } : d))
  }, [])

  const onSave = useCallback(async () => {
    if (!draft || saving) return
    setSaving(true)
    setError(null)
    try {
      await saveEmotionColors(queryClient, draft) // 성공 시 store·settings cache 즉시 갱신(A9)
      await navigate({ to: redirect ?? '/' })
    } catch {
      // 서버가 거부하면 부분 저장 없이 draft 유지 + 오류 표시(A8).
      setError('색을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [draft, saving, queryClient, navigate, redirect])

  if (isError) {
    return (
      <div className="grid min-h-dvh w-full place-items-center bg-[#05060f] px-6 text-center">
        <div>
          <p className="text-sm text-white/50">설정을 불러오지 못했어요.</p>
          <button
            onClick={() => void refetch()}
            className="mt-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:text-white/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="grid min-h-dvh w-full place-items-center bg-[#05060f]">
        <p className="text-sm tracking-wide text-white/40">감정의 색을 불러오는 중…</p>
      </div>
    )
  }

  const selColor = draft[selected]

  return (
    <div className="min-h-dvh w-full bg-[#05060f] text-white/90">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-28 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-8">
        <header className="mb-6">
          <h1 className="text-xl font-light tracking-[0.08em] text-white/90">감정의 색을 정해요</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/45">
            기억의 별은 그 순간의 감정으로 빛나요. 13가지 감정마다 색을 골라 두면, 그 색으로 우주가 그려져요.
          </p>
        </header>

        {/* 13 감정 swatch — 사분면 순서. 누르면 그 감정을 편집한다(선택 강조). */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MOOD_ORDER.map((mood) => {
            const active = mood === selected
            return (
              <button
                key={mood}
                type="button"
                onClick={() => setSelected(mood)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition',
                  active
                    ? 'border-white/60 bg-white/10'
                    : 'border-white/10 bg-white/5 hover:border-white/25',
                )}
              >
                <span
                  aria-hidden
                  className="size-5 shrink-0 rounded-full border border-white/20"
                  style={{ backgroundColor: draft[mood] }}
                />
                <span className="truncate text-xs text-white/80">{MOOD_LABEL[mood]}</span>
              </button>
            )
          })}
        </div>

        {/* 선택 감정: 큰 미리보기(별을 닮은 글로우 오브) + 라벨/hex, 그리고 커스텀 피커. */}
        <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3 sm:w-44">
            <div
              aria-hidden
              className="size-28 rounded-full"
              style={{
                backgroundColor: selColor,
                boxShadow: `0 0 48px -4px ${selColor}, 0 0 18px -2px ${selColor}`,
              }}
            />
            <div className="text-center">
              <p className="text-base text-white/90">{MOOD_LABEL[selected]}</p>
              <p className="font-mono text-xs uppercase text-white/45">{selColor}</p>
            </div>
          </div>
          <div className="flex-1">
            <EmotionColorPicker
              value={selColor}
              recommended={recommended[selected]}
              onChange={(hex) => setColor(selected, hex)}
              label={MOOD_LABEL[selected]}
            />
          </div>
        </div>
      </div>

      {/* 하단 고정 command bar — 전체 추천 초기화 + 저장(safe-area 보정). */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#05060f]/90 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => setDraft({ ...recommended })}
            disabled={saving}
            className="rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white/60 transition hover:text-white/90 disabled:opacity-40"
          >
            전체 추천으로
          </button>
          {error && <span className="text-xs text-red-300/80">{error}</span>}
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="ml-auto rounded-full bg-white/90 px-6 py-2.5 text-sm font-medium text-black shadow-[0_8px_30px_-10px_rgba(180,180,255,0.5)] transition hover:-translate-y-px hover:bg-white disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? '저장 중…' : '저장하고 우주로'}
          </button>
        </div>
      </div>
    </div>
  )
}
