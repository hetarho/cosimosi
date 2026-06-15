// 보낸/받은 별 목록(spec 36): 우주 상단 컨트롤의 "주고받은 별" 버튼 + 목록 모달. 보낸 탭은
// 상태(대기/수락/거절/취소/만료)로 친구의 수락 여부를 확인하는 곳이고(알림 없음 — 비목표), 대기 중
// 보낸 별은 링크 재복사·취소가 가능하다(acceptance 1.4, 3.3). 받은 탭은 내가 수락/거절한 별 이력.
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { GiftStatus, type GiftSummary } from '@/shared/api'
import { ghostButtonCls } from '@/shared/ui'
import { cancelStarGift, listStarGiftsInvalidateKey, listStarGiftsQueryOptions } from '../api/gift-queries'

const STATUS_LABEL: Record<GiftStatus, string> = {
  [GiftStatus.UNSPECIFIED]: '',
  [GiftStatus.PENDING]: '대기 중',
  [GiftStatus.ACCEPTED]: '공명 중',
  [GiftStatus.DECLINED]: '거절됨',
  [GiftStatus.CANCELED]: '취소됨',
  [GiftStatus.EXPIRED]: '만료됨',
}

const STATUS_CLS: Record<GiftStatus, string> = {
  [GiftStatus.UNSPECIFIED]: 'text-white/40',
  [GiftStatus.PENDING]: 'text-amber-200/90',
  [GiftStatus.ACCEPTED]: 'text-indigo-200/90',
  [GiftStatus.DECLINED]: 'text-white/40',
  [GiftStatus.CANCELED]: 'text-white/40',
  [GiftStatus.EXPIRED]: 'text-white/40',
}

function giftUrl(token: string): string {
  if (typeof window === 'undefined' || !token) return ''
  return new URL(`/gift/${token}`, window.location.origin).toString()
}

/** 보낸 별 한 줄 — 상태 배지 + 상대 표시명 + 한마디. 대기 중이면 링크 복사·취소. */
function SentRow({ g, onCancel }: { g: GiftSummary; onCancel: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const name = g.counterpartDisplayName || '아직 받지 않음'
  async function copy() {
    try {
      await navigator.clipboard.writeText(giftUrl(g.token))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드 차단 — 무시(목록에서 다시 시도 가능) */
    }
  }
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-white/80">{name}</span>
        <span className={`shrink-0 text-xs ${STATUS_CLS[g.status]}`}>{STATUS_LABEL[g.status]}</span>
      </div>
      {g.message && <p className="ph-no-capture truncate text-xs text-white/45">“{g.message}”</p>}
      {g.status === GiftStatus.PENDING && (
        <div className="flex gap-2">
          <button type="button" onClick={() => void copy()} className={`${ghostButtonCls} flex-1 py-1 text-xs`}>
            {copied ? '복사됨 ✓' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={() => onCancel(g.giftId)}
            className={`${ghostButtonCls} py-1 text-xs text-rose-300`}
          >
            취소
          </button>
        </div>
      )}
    </li>
  )
}

/** 받은 별 한 줄 — 상태 + 보낸이 표시명 + 한마디(읽기 전용 이력). */
function ReceivedRow({ g }: { g: GiftSummary }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-white/80">{g.counterpartDisplayName || '어느 우주'}</span>
        <span className={`shrink-0 text-xs ${STATUS_CLS[g.status]}`}>{STATUS_LABEL[g.status]}</span>
      </div>
      {g.message && <p className="ph-no-capture truncate text-xs text-white/45">“{g.message}”</p>}
    </li>
  )
}

function StarGiftsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const query = useQuery(listStarGiftsQueryOptions())
  const [tab, setTab] = useState<'sent' | 'received'>('sent')
  const [err, setErr] = useState<string | null>(null)

  async function cancel(giftId: string) {
    setErr(null)
    try {
      await cancelStarGift(giftId)
      await qc.invalidateQueries({ queryKey: listStarGiftsInvalidateKey() })
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  const sent = query.data?.sent ?? []
  const received = query.data?.received ?? []
  const list = tab === 'sent' ? sent : received

  const tabCls = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm transition ${
      active ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-88 max-w-[90vw] flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-white/85 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="주고받은 별"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">주고받은 별</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-md text-white/45 transition hover:text-white/90"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          <button type="button" className={tabCls(tab === 'sent')} onClick={() => setTab('sent')}>
            보낸 별 ({sent.length})
          </button>
          <button type="button" className={tabCls(tab === 'received')} onClick={() => setTab('received')}>
            받은 별 ({received.length})
          </button>
        </div>

        {query.isPending && <p className="text-sm text-white/50">불러오는 중…</p>}
        {!query.isPending && list.length === 0 && (
          <p className="py-6 text-center text-sm text-white/40">
            {tab === 'sent' ? '아직 보낸 별이 없어요.' : '아직 받은 별이 없어요.'}
          </p>
        )}

        <ul className="flex flex-col gap-2 overflow-y-auto overscroll-contain">
          {tab === 'sent'
            ? sent.map((g) => <SentRow key={g.giftId} g={g} onCancel={(id) => void cancel(id)} />)
            : received.map((g) => <ReceivedRow key={g.giftId} g={g} />)}
        </ul>

        {err && <p className="text-xs break-all text-rose-300/90">{err}</p>}
      </div>
    </div>
  )
}

/** 주고받은 별 진입점(spec 36) — home 컨트롤 스택의 버튼 + 목록 모달. 데모엔 서버가 없어 숨긴다. */
export function StarGiftsButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  if (isDemoMode()) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/20 ${className}`}
      >
        주고받은 별
      </button>
      {open && <StarGiftsModal onClose={() => setOpen(false)} />}
    </>
  )
}
