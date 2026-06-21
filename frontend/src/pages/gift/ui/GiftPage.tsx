// 받은 별 페이지(spec 36, /gift/:token, SessionGate 안): 보낸 별 카드(조각 텍스트·감정 색·보낸이·
// 한마디) + "내 기억으로 다시 쓰기" 폼(13감정·강도) + 거절. 수락 = 재작성이 한 트랜잭션으로 내 우주에
// 새 별을 낳고 두 별을 공명으로 잇는다 → 성공 시 내 우주로 이동해 새 별로 fly-to(탄생 연출은 10/21 기존).
import { useState } from 'react'
import { Code, ConnectError } from '@connectrpc/connect'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { errorMessage } from '@/shared/lib'
import { Mood, GiftStatus } from '@/shared/api'
import { MOOD_AFFECT, MOODS_BY_QUADRANT, moodLabel, resolveMoodRgb } from '@/shared/config'
import { moodFromProto, universeInvalidateKey } from '@/entities/memory'
import { Dropdown, ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import { acceptStarGift, declineStarGift, getStarGiftQueryOptions } from '../api/gift-queries'

const MOOD_OPTIONS = MOODS_BY_QUADRANT.map((m) => Mood[m.toUpperCase() as keyof typeof Mood])

const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-indigo-400/50'

function moodCss(mood: Mood): string {
  const [r, g, b] = resolveMoodRgb(moodFromProto(mood))
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
}

/** 보낸 별 카드 — 조각 텍스트(감정 색 테두리) + 보낸이 표시명 + 한마디. */
function SentStarCard({
  text,
  mood,
  senderName,
  message,
}: {
  text: string
  mood: Mood
  senderName: string
  message: string
}) {
  const color = moodCss(mood)
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border bg-white/5 p-4"
      style={{ borderColor: color, boxShadow: `0 0 24px -8px ${color}` }}
    >
      <div className="flex items-center gap-2 text-xs text-white/50">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="truncate">{senderName || '어느 우주'}님이 보낸 별</span>
      </div>
      <p className="ph-no-capture whitespace-pre-wrap text-sm leading-relaxed text-white/90">{text}</p>
      {message && <p className="ph-no-capture border-t border-white/10 pt-2 text-xs text-white/55">“{message}”</p>}
    </div>
  )
}

/** 비-pending 상태(이미 응답됨·취소·만료) 안내 — 내용 없이 상태만. */
function statusMessage(status: GiftStatus): string {
  switch (status) {
    case GiftStatus.ACCEPTED:
      return '이미 함께한 기억이에요 — 수락된 초대입니다.'
    case GiftStatus.DECLINED:
      return '이미 거절한 초대예요.'
    case GiftStatus.CANCELED:
      return '보낸 사람이 취소한 초대예요.'
    case GiftStatus.EXPIRED:
      return '만료된 초대예요 (링크는 30일간 유효해요).'
    default:
      return '유효하지 않은 초대예요.'
  }
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-zinc-950 p-4">
      <div className="my-auto flex w-96 max-w-[92vw] flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-white/85 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export function GiftPage() {
  const { token } = useParams({ from: '/gift/$token' })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const query = useQuery(getStarGiftQueryOptions(token))

  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>(Mood.NEUTRAL)
  const [intensity, setIntensity] = useState(0.5)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function accept() {
    if (text.trim() === '') {
      setErr('다시 쓸 내용을 적어 주세요.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const valence = MOOD_AFFECT[moodFromProto(mood)].valence
      const res = await acceptStarGift(token, text.trim(), mood, intensity, valence)
      // 새 별이 다음 GetUniverse에 실리도록 우주 캐시를 무효화하고, ?fly로 그 별에 fly-to를 건다.
      await qc.invalidateQueries({ queryKey: universeInvalidateKey() })
      void navigate({ to: '/', search: { fly: res.memoryId } })
    } catch (e) {
      setErr(errorMessage(e))
      setBusy(false)
    }
  }

  async function decline() {
    setBusy(true)
    setErr(null)
    try {
      await declineStarGift(token)
      void navigate({ to: '/' })
    } catch (e) {
      setErr(errorMessage(e))
      setBusy(false)
    }
  }

  if (query.isPending) {
    return (
      <PageShell>
        <p className="text-center text-sm text-white/50">불러오는 중…</p>
      </PageShell>
    )
  }

  if (query.isError) {
    const notFound = ConnectError.from(query.error).code === Code.NotFound
    return (
      <PageShell>
        <h1 className="text-base font-medium">함께한 기억</h1>
        <p className="text-sm text-white/60">
          {notFound ? '유효하지 않거나 만료된 링크예요.' : errorMessage(query.error)}
        </p>
        <button type="button" onClick={() => void navigate({ to: '/' })} className={primaryButtonCls}>
          내 우주로
        </button>
      </PageShell>
    )
  }

  const gift = query.data
  if (gift.status !== GiftStatus.PENDING) {
    return (
      <PageShell>
        <h1 className="text-base font-medium">함께한 기억</h1>
        <p className="text-sm text-white/60">{statusMessage(gift.status)}</p>
        <button type="button" onClick={() => void navigate({ to: '/' })} className={primaryButtonCls}>
          내 우주로
        </button>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div>
        <h1 className="text-base font-medium">함께한 기억이 도착했어요</h1>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          같은 사건도 두 사람의 기억은 다릅니다. 이 별을 <b className="text-white/70">당신의 관점으로
          다시 써</b> 주세요 — 당신의 우주에 새 별이 태어나고 두 기억이 공명으로 이어져요.
        </p>
      </div>

      <SentStarCard text={gift.fragmentText} mood={gift.mood} senderName={gift.senderDisplayName} message={gift.message} />

      {/* 재작성 폼 — record-memory의 13감정·강도 컨벤션 재사용(단일 조각). */}
      <div className="flex flex-col gap-3">
        <textarea
          aria-label="내 기억으로 다시 쓰기"
          className={`${inputCls} ph-no-capture h-28 resize-none`}
          placeholder="나는 그날을 이렇게 기억해요…"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-2">
          {/* 커스텀 드롭다운(shared/ui) — 네이티브 select의 흰 OS 목록 대신 다크 팝오버. 감정 색 점 포함. */}
          <Dropdown
            ariaLabel="감정"
            className="flex-1"
            value={mood}
            disabled={busy}
            onChange={(m) => setMood(m)}
            options={MOOD_OPTIONS.map((m) => ({
              value: m,
              label: moodLabel(moodFromProto(m)),
              color: moodCss(m),
            }))}
          />
          <label className="flex flex-1 items-center gap-1.5 text-[10px] text-white/45">
            강도
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              className="min-w-0 flex-1"
              value={intensity}
              disabled={busy}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      {err && <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {err}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => void decline()} disabled={busy} className={`${ghostButtonCls} disabled:opacity-50`}>
          거절
        </button>
        <button type="button" onClick={() => void accept()} disabled={busy} className={`${primaryButtonCls} flex-1 disabled:opacity-50`}>
          {busy ? '별을 띄우는 중…' : '✦ 내 별로 띄우기'}
        </button>
      </div>
    </PageShell>
  )
}
