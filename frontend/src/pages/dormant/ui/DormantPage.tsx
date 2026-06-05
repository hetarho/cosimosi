// Dormant-star search (spec 12): find long-unrecalled (dim) stars by list/search, then
// click one to fly the camera to it in /universe and re-ignite it (recall, 11). The
// dormant list is a search aid — GetUniverse still renders the whole graph (these stars
// are NOT removed, just dim — constitution §2). Empty list → friendly guidance (4.2).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { moodLabel } from '@/shared/config'
import { useCameraMode } from '@/widgets/universe-canvas'
import { listDormant, type DormantStar } from '../api/list-dormant'

function daysAgo(epochMs: number): number {
  return Math.floor((Date.now() - epochMs) / 86_400_000)
}

export function DormantPage() {
  const navigate = useNavigate()
  const focusStar = useCameraMode((s) => s.focusStar)
  const [stars, setStars] = useState<DormantStar[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    listDormant()
      .then((s) => {
        if (!cancelled) setStars(s)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!stars) return []
    const q = query.trim().toLowerCase()
    if (!q) return stars
    return stars.filter(
      (s) =>
        moodLabel(s.mood).toLowerCase().includes(q) ||
        s.mood.includes(q) ||
        s.memoryId.toLowerCase().includes(q),
    )
  }, [stars, query])

  function open(memoryId: string) {
    focusStar(memoryId) // canvas FlyToController picks this up on /universe
    void navigate({ to: '/universe' })
  }

  return (
    <div className="min-h-screen bg-[#050510] px-6 py-10 text-white/90">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-light tracking-wide">잠든 별</h1>
          <p className="text-sm text-white/45">
            오래 회상하지 않아 어두워진 별이에요. 클릭하면 그 별로 날아가 다시 회상할 수 있어요.
          </p>
        </header>

        <input
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
          placeholder="감정으로 검색 (예: 기쁨, sad)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">⚠ {error}</p>}

        {stars === null && !error && <p className="text-sm text-white/40">불러오는 중…</p>}

        {stars !== null && stars.length === 0 && (
          <p className="rounded-md border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/45">
            잠든 별이 아직 없습니다. 별이 어두워질 만큼 시간이 지나면 여기 모여요.
          </p>
        )}

        {stars !== null && stars.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-white/40">검색 결과가 없어요.</p>
        )}

        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.memoryId}>
              <button
                type="button"
                onClick={() => open(s.memoryId)}
                className="flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/10"
              >
                {/* brightness dot — dim stars read as faint */}
                <span
                  className="h-3 w-3 shrink-0 rounded-full bg-white"
                  style={{ opacity: Math.max(0.12, s.brightness) }}
                />
                <span className="text-sm text-white/85">{moodLabel(s.mood)}</span>
                <span className="ml-auto text-xs text-white/35">{daysAgo(s.lastRecalledAt)}일 전 회상</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
