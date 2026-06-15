import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { create } from '@bufbuild/protobuf'
import { errorMessage } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { GetShareSettingsResponseSchema } from '@/shared/api'
import { ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import {
  rotateShareSlug,
  shareSettingsQueryOptions,
  updateShareSettings,
} from '../api/share-queries'

const MAX_NAME = 60

type ShareState = { enabled: boolean; slug: string; displayName: string }

/** slug → 절대 공개 URL. 현재 오리진 기준(`/u/:slug`)이라 dev/preview/prod 어디서든 맞다. */
function publicUrl(slug: string): string {
  if (typeof window === 'undefined' || !slug) return ''
  return new URL(`/u/${slug}`, window.location.origin).toString()
}

/** 우주 공개 설정 모달(spec 35): 공개 토글·표시명·URL 복사·슬러그 회전. 풍경만 공개되고 일기 내용은
 *  어떤 경로로도 나가지 않음을 분명히 안내한다. */
function ShareUniverseModal({ onClose }: { onClose: () => void }) {
  const query = useQuery(shareSettingsQueryOptions())
  const qc = useQueryClient()
  // The query cache IS the source of truth (mutations write back via setQueryData), so there is
  // no derived local copy to seed in an effect. `draft` is the unsaved name edit: null = "not
  // edited", so the input shows the server value; a successful write clears it to re-sync.
  const settings = query.data ?? null
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)

  const name = draft ?? settings?.displayName ?? ''

  // 변경 응답으로 GetShareSettings 캐시를 직접 교체(재오픈 시에도 최신) + 표시명 draft를 비워 서버 값에
  // 재동기화한다. 스키마로 정식 메시지를 만들어 setQueryData의 InfiniteData 유니온 타입과 어긋나지 않게 한다.
  function apply(res: ShareState) {
    qc.setQueryData(
      shareSettingsQueryOptions().queryKey,
      create(GetShareSettingsResponseSchema, {
        enabled: res.enabled,
        slug: res.slug,
        displayName: res.displayName,
      }),
    )
    setDraft(null)
  }

  async function run(fn: () => Promise<ShareState>) {
    setBusy(true)
    setErr(null)
    try {
      apply(await fn())
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const url = settings?.enabled ? publicUrl(settings.slug) : ''

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드 차단 — 사용자가 직접 선택 복사할 수 있게 URL은 화면에 보인다 */
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
        aria-label="우주 공개 설정"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium">우주 공개</h2>
            <p className="mt-1 text-xs text-white/45">
              별 배치·색·연결 같은 <b className="text-white/70">풍경만</b> 공개돼요. 일기 내용은
              공개되지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-md text-white/45 transition hover:text-white/90"
          >
            ✕
          </button>
        </div>

        {query.isPending && <p className="text-sm text-white/50">불러오는 중…</p>}

        {settings && (
          <>
            {/* 공개 토글 */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => updateShareSettings(!settings.enabled, name.trim()))}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition disabled:opacity-50 ${
                settings.enabled
                  ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span>{settings.enabled ? '공개 중' : '비공개'}</span>
              <span
                className={`relative h-5 w-9 rounded-full transition ${settings.enabled ? 'bg-indigo-400' : 'bg-white/20'}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${settings.enabled ? 'left-4.5' : 'left-0.5'}`}
                />
              </span>
            </button>

            {/* 표시명 */}
            <label className="flex flex-col gap-1.5 text-xs text-white/50">
              표시명 (비우면 “어느 우주”)
              <div className="flex gap-2">
                <input
                  value={name}
                  maxLength={MAX_NAME}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="예: 봄날의 우주"
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-indigo-400/50"
                />
                <button
                  type="button"
                  disabled={busy || name.trim() === settings.displayName}
                  onClick={() => void run(() => updateShareSettings(settings.enabled, name.trim()))}
                  className={`${ghostButtonCls} shrink-0 disabled:opacity-40`}
                >
                  저장
                </button>
              </div>
            </label>

            {/* 공개 URL + 복사 + 회전 (공개 중일 때만) */}
            {settings.enabled && settings.slug && (
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <code className="block truncate text-xs text-indigo-200/90" title={url}>
                  {url}
                </code>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void copy()} className={`${primaryButtonCls} flex-1`}>
                    {copied ? '복사됨 ✓' : '링크 복사'}
                  </button>
                  {confirmRotate ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirmRotate(false)
                        void run(rotateShareSlug)
                      }}
                      className={`${ghostButtonCls} shrink-0 text-rose-300 disabled:opacity-50`}
                    >
                      정말 발급
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRotate(true)}
                      className={`${ghostButtonCls} shrink-0`}
                      title="이전 링크는 즉시 끊겨요"
                    >
                      새 링크
                    </button>
                  )}
                </div>
                {confirmRotate && (
                  <p className="text-[11px] text-rose-300/80">
                    새 링크를 발급하면 이전 링크는 즉시 끊겨요.{' '}
                    <button type="button" className="underline" onClick={() => setConfirmRotate(false)}>
                      취소
                    </button>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {err && <p className="text-xs break-all text-rose-300/90">{err}</p>}
      </div>
    </div>
  )
}

/** 우주 공개 진입점(spec 35) — home 컨트롤 스택의 "공유" 버튼 + 설정 모달. 데모엔 서버가 없어 숨긴다.
 *  31의 리스트 셸(OverlayHost)은 탐색/목록용 peek 시트라, 공개 설정 같은 콤팩트 다이얼로그는
 *  AppearanceSwitcher처럼 자체 모달로 띄운다. */
export function ShareUniverseButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  if (isDemoMode()) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/20 ${className}`}
      >
        공유
      </button>
      {open && <ShareUniverseModal onClose={() => setOpen(false)} />}
    </>
  )
}
