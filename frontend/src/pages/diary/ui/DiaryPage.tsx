// 독립 보호 일기 페이지(change 09, A10) — 우주 셸과 별개로 일기를 읽고 훑는 전용 화면. 목록·검색·
// 감정/날짜 필터 + 읽기 전용 상세 + "우주에서 보기" 동선을 제공한다. 원본 일기는 불변(헌법1) —
// 편집/삭제 컨트롤이 없고 상세는 부작용 없는 GetRecord로 전문을 읽는다(별 layer 미변경, A11).
// "우주에서 보기"는 `/`로 돌아가 ?record=로 그 record의 별을 frame-all 한다(HomePage가 1회 소비).
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Telescope } from 'lucide-react'
import { errorMessage } from '@/shared/lib'
import { MoodChips } from '@/shared/ui'
import { moodLabel, type Mood } from '@/shared/config'
import {
  moodFromProto,
  recordDetailQueryOptions,
  recordsQueryOptions,
} from '@/entities/memory'
import { filterDiaries, type DiaryFilterEntry } from '@/features/diary-list'

interface DiaryRow extends DiaryFilterEntry {
  starCount: number
}

/** 읽기 전용 일기 상세 — GetRecord로 원본 전문을 읽는다(부작용 없음, A11). 편집/삭제 없음(헌법1). */
function DiaryDetail({
  row,
  onBack,
  onSeeInUniverse,
}: {
  row: DiaryRow
  onBack: () => void
  onSeeInUniverse: () => void
}) {
  const { data, isPending, isError, error, refetch } = useQuery(recordDetailQueryOptions(row.recordId))
  const record = data?.record
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white/90"
        >
          <ArrowLeft className="size-4" /> 목록
        </button>
        <button
          type="button"
          onClick={onSeeInUniverse}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          <Telescope className="size-4" /> 우주에서 보기
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-white/45">
        <span>{row.entryDate}</span>
        <span>
          별 {row.starCount}개{record && record.mood ? ` · ${moodLabel(moodFromProto(record.mood))}` : ''}
        </span>
      </div>

      {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}
      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-300">⚠ {errorMessage(error)}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20"
          >
            다시 시도
          </button>
        </div>
      )}
      {record && (
        // ph-no-capture: 원본 일기 전문 — PostHog autocapture 차단(프라이버시 헌법).
        <p className="ph-no-capture whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">
          {record.body}
        </p>
      )}
    </section>
  )
}

export function DiaryPage() {
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useQuery(recordsQueryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [moods, setMoods] = useState<Mood[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo<DiaryRow[]>(
    () =>
      (data?.records ?? []).map((r) => ({
        recordId: r.recordId,
        entryDate: r.entryDate,
        bodyExcerpt: r.bodyExcerpt,
        moods: r.moods.map(moodFromProto),
        starCount: r.starCount,
      })),
    [data],
  )
  const available = useMemo(() => {
    const set = new Set<Mood>()
    for (const r of rows) for (const m of r.moods) set.add(m)
    return [...set]
  }, [rows])
  const filtered = useMemo(
    () => filterDiaries(rows, { query, moods, from: from || undefined, to: to || undefined }),
    [rows, query, moods, from, to],
  )
  const selected = selectedId ? rows.find((r) => r.recordId === selectedId) ?? null : null
  const toggleMood = (m: Mood) =>
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-white/90">일기</h1>
        <button
          type="button"
          onClick={() => void navigate({ to: '/' })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:text-white/90"
        >
          우주로
        </button>
      </header>

      {selected ? (
        <DiaryDetail
          row={selected}
          onBack={() => setSelectedId(null)}
          onSeeInUniverse={() => void navigate({ to: '/', search: { record: selected.recordId } })}
        />
      ) : (
        <>
          <input
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
            placeholder="날짜·내용·감정으로 검색…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {available.length > 0 && <MoodChips selected={moods} onToggle={toggleMood} available={available} />}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <input
              type="date"
              aria-label="시작 날짜"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-white/30"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span aria-hidden>—</span>
            <input
              type="date"
              aria-label="끝 날짜"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-white/30"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}
          {isError && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-red-500/10 px-3 py-2">
              <p className="text-sm text-red-300">⚠ {errorMessage(error)}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded-md bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20"
              >
                다시 시도
              </button>
            </div>
          )}
          {data?.records && data.records.length === 0 && (
            <p className="rounded-md border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/45">
              아직 일기가 없어요. 우주에서 첫 일기를 적어보세요.
            </p>
          )}
          {data?.records && data.records.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-white/40">검색 결과가 없어요.</p>
          )}

          <ul className="flex flex-col gap-2">
            {filtered.map((r) => (
              <li key={r.recordId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.recordId)}
                  className="flex w-full flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <span className="flex items-center justify-between text-xs text-white/45">
                    <span>{r.entryDate}</span>
                    <span>별 {r.starCount}개</span>
                  </span>
                  {/* ph-no-capture: 일기 발췌 — PostHog autocapture 차단(프라이버시 헌법). */}
                  <span className="ph-no-capture line-clamp-2 text-sm text-white/80">{r.bodyExcerpt}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
