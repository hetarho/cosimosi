// Star explorer list (change 09, 별 탭) — CONTENT ONLY for the universe shell's telescope sheet.
// Shows AWAKE and DORMANT stars in ONE filterable list (the old separate 잠든 별 entry point is
// gone): search · emotion facet · entry-date range · dormancy state. Picking a star flies the
// camera to it (the page wires onSelect → navigationActor.FLY_TO_STAR + shell setPeek) and the
// recall panel converges on arrival — we never leave the universe (Architecture §3.1). Data is
// the loaded universe store merged with the records map (entryDate); brightness/dormancy are
// computed client-side from the virtual clock (08·12), same as the canvas. The chrome
// (header/peek/snap) is the host's job; this emits intro + filters + list.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { moodLabel, type Mood } from '@/shared/config'
import { virtualNowMs } from '@/shared/lib/demo'
import { MoodChips } from '@/shared/ui'
import {
  isDormant,
  recordsQueryOptions,
  starBrightness,
  useMemoryStore,
} from '@/entities/memory'
import { filterStars, type DormancyFilter, type StarFilterEntry } from '../model/filters'

export interface StarExplorerListProps {
  /** A star was chosen — the page flies to it (FLY_TO_STAR) + peeks the sheet. */
  onSelect: (memoryId: string) => void
}

interface StarRow extends StarFilterEntry {
  brightness: number
}

const DORMANCY_TABS: { key: DormancyFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'awake', label: '깨어있는' },
  { key: 'dormant', label: '잠든 별' },
]

export function StarExplorerList({ onSelect }: StarExplorerListProps) {
  const stars = useMemoryStore((s) => s.stars)
  // entryDate facet은 원본 일기 목록에서(별엔 날짜가 없다 — record_id로 맵). 실패해도 별 목록은 뜬다.
  const { data: recordsData } = useQuery(recordsQueryOptions())

  const [query, setQuery] = useState('')
  const [moods, setMoods] = useState<Mood[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dormancy, setDormancy] = useState<DormancyFilter>('all')

  const dateByRecord = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of recordsData?.records ?? []) m.set(r.recordId, r.entryDate)
    return m
  }, [recordsData])

  // 별 layer를 필터 입력으로 정규화. now=가상 시계로 잠듦/밝기를 캔버스와 동일 규칙으로 계산(08·12).
  // 오래 안 본 별이 먼저 오게 lastRecalledAt 오름차순 정렬(구 잠든 별 목록의 "가장 오래 잠든 별 먼저"
  // 우선순위 보존) — 일반 별·잠든 별을 한 목록에서 보여줄 때도 가장 방치된 기억이 위로 떠오른다.
  const rows = useMemo<StarRow[]>(() => {
    const now = virtualNowMs()
    return stars
      .map(({ memory }) => ({
        memoryId: memory.id,
        mood: memory.mood,
        entryDate: dateByRecord.get(memory.recordId),
        lastRecalledAt: memory.lastRecalledAt,
        dormant: isDormant(memory.lastRecalledAt, now),
        brightness: starBrightness(memory.lastRecalledAt, now),
      }))
      .sort((a, b) => a.lastRecalledAt - b.lastRecalledAt)
  }, [stars, dateByRecord])

  // "N일 전 회상" — 가상 시계(spec 19) 기준 경과일. 구 DormantSheet의 recency 라벨을 보존한다.
  const now = virtualNowMs()
  const daysAgo = (epochMs: number) => Math.max(0, Math.floor((now - epochMs) / 86_400_000))

  const available = useMemo(() => {
    const set = new Set<Mood>()
    for (const r of rows) set.add(r.mood)
    return [...set]
  }, [rows])

  const filtered = useMemo(
    () =>
      filterStars(rows, { query, moods, from: from || undefined, to: to || undefined, dormancy }),
    [rows, query, moods, from, to, dormancy],
  )
  const toggleMood = (m: Mood) =>
    setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  return (
    <>
      <p className="shrink-0 text-xs leading-relaxed text-white/45">
        우주의 별을 한 목록에서 찾아요. 잠든 별도 함께 있어요 — 고르면 그 별로 날아가 회상해요.
      </p>

      <input
        className="w-full shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
        placeholder="감정·별로 검색 (예: 기쁨, sad)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* 잠듦 상태 세그먼트 */}
      <div className="flex shrink-0 gap-1 rounded-lg bg-white/5 p-1 text-xs">
        {DORMANCY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={dormancy === t.key}
            onClick={() => setDormancy(t.key)}
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              dormancy === t.key ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {available.length > 0 && (
        <MoodChips selected={moods} onToggle={toggleMood} available={available} />
      )}

      <div className="flex shrink-0 items-center gap-2 text-xs text-white/50">
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

      {stars.length === 0 && (
        <p className="rounded-md border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
          아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
        </p>
      )}
      {stars.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-white/40">조건에 맞는 별이 없어요.</p>
      )}

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        {filtered.map((s) => (
          <li key={s.memoryId}>
            <button
              type="button"
              onClick={() => onSelect(s.memoryId)}
              className="flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full bg-white"
                style={{ opacity: Math.max(0.12, s.brightness) }}
              />
              <span className="text-sm text-white/85">{moodLabel(s.mood)}</span>
              {s.dormant && <span className="text-[11px] text-white/35">잠든 별</span>}
              <span className="ml-auto text-xs text-white/35">{daysAgo(s.lastRecalledAt)}일 전 회상</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
