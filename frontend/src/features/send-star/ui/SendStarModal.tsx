// 별 보내기 모달(spec 36): 별 상세에서 "이 별 보내기" → 명시 고지 → 한마디(선택) → 토큰 URL 발급·복사.
// 보내기 = 그 조각 텍스트의 1:1 opt-in 공개이므로, 링크를 발급하기 전에 고지를 분명히 보여준다(acceptance 1.1).
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/shared/lib'
import { ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import { listStarGiftsInvalidateKey, sendStarGift } from '../api/gift-queries'

const MAX_MESSAGE = 280

/** token → 절대 수신 URL(`/gift/:token`). 현재 오리진 기준이라 dev/preview/prod 어디서든 맞다. */
function giftUrl(token: string): string {
  if (typeof window === 'undefined' || !token) return ''
  return new URL(`/gift/${token}`, window.location.origin).toString()
}

/** 별 보내기 모달. memoryId = 보낼 내 조각 별. 발급 후 URL을 복사해 사용자가 직접 전달한다(카톡 등).
 *  발급 즉시 보낸 목록이 갱신되도록 ListStarGifts 캐시를 무효화한다. */
export function SendStarModal({ memoryId, onClose }: { memoryId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const url = token ? giftUrl(token) : ''

  async function send() {
    setBusy(true)
    setErr(null)
    try {
      const res = await sendStarGift(memoryId, message.trim())
      setToken(res.token)
      void qc.invalidateQueries({ queryKey: listStarGiftsInvalidateKey() })
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드 차단 — URL이 화면에 보이므로 직접 선택 복사할 수 있다 */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-88 max-w-[90vw] flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-white/85 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="별 보내기"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium">별 보내기</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              이 링크를 받은 사람은 <b className="text-white/70">이 별의 조각 글</b>을 읽게 돼요. 친구가
              수락하면 자기 관점으로 다시 써서, 두 우주에 걸친 하나의 사건이 공명으로 이어집니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 transition hover:text-white/90"
          >
            ✕
          </button>
        </div>

        {token == null ? (
          <>
            <label className="flex flex-col gap-1.5 text-xs text-white/50">
              한마디 (선택)
              <textarea
                value={message}
                maxLength={MAX_MESSAGE}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="예: 그날 같이 본 별, 너는 어떻게 기억해?"
                className="ph-no-capture h-20 resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-indigo-400/50"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className={`${primaryButtonCls} disabled:opacity-50`}
            >
              {busy ? '링크 발급 중…' : '링크 발급'}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/50">이 링크를 친구에게 보내 주세요 (30일 후 만료).</p>
            <code className="block truncate text-xs text-indigo-200/90" title={url}>
              {url}
            </code>
            <div className="flex gap-2">
              <button type="button" onClick={() => void copy()} className={`${primaryButtonCls} flex-1`}>
                {copied ? '복사됨 ✓' : '링크 복사'}
              </button>
              <button type="button" onClick={onClose} className={ghostButtonCls}>
                닫기
              </button>
            </div>
          </div>
        )}

        {err && <p className="text-xs break-all text-rose-300/90">{err}</p>}
      </div>
    </div>
  )
}
