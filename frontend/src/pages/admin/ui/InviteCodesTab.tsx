// 초대 코드 관리 탭(spec 41) — 발행(1회용/시간지정/무제한 프리셋 + 라벨) + 발행 목록(코드·상태·
// 사용량·만료·발행인·라벨·복사·취소). 직교 모델을 프리셋으로 노출하고, 발행은 InviteAdminService
// (admin allowlist 뒤). 게이트가 제거되면 이 파일과 invite-admin-queries를 통째로 지운다.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard, ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import { InviteCodeStatus, type InviteCode } from '@/shared/api'
import { VALUES } from '@/shared/config'
import {
  inviteCodesQueryOptions,
  useIssueInviteCode,
  useRevokeInviteCode,
  type IssueInput,
} from '../api/invite-admin-queries'
import { ErrorNotice } from './ErrorNotice'

type Preset = 'one_time' | 'timed' | 'unlimited'

const PRESETS: { value: Preset; label: string; hint: string }[] = [
  { value: 'one_time', label: '1회용', hint: '한 명만 사용' },
  { value: 'timed', label: '시간지정', hint: '기간 동안 유효' },
  { value: 'unlimited', label: '무제한', hint: '횟수·기간 제한 없음' },
]

const STATUS_META: Record<InviteCodeStatus, { label: string; cls: string }> = {
  [InviteCodeStatus.UNSPECIFIED]: { label: '-', cls: 'text-white/40' },
  [InviteCodeStatus.ACTIVE]: { label: '활성', cls: 'text-emerald-300/90' },
  [InviteCodeStatus.EXPIRED]: { label: '만료', cls: 'text-amber-300/80' },
  [InviteCodeStatus.EXHAUSTED]: { label: '소진', cls: 'text-white/45' },
  [InviteCodeStatus.REVOKED]: { label: '취소됨', cls: 'text-red-300/80' },
}

function fmtHours(h: number): string {
  if (h % 24 === 0) return `${h / 24}일`
  return `${h}시간`
}

function fmtDate(unixSec: bigint): string {
  if (unixSec === 0n) return '—'
  return new Date(Number(unixSec) * 1000).toLocaleDateString()
}

// Web Share API 지원 여부(1회 평가) + 초대 URL 빌더(현재 origin 기준, change 05).
const CAN_SHARE = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
const inviteUrl = (code: string) => `${window.location.origin}/invite?code=${encodeURIComponent(code)}`

export function InviteCodesTab() {
  const { data, isPending, isError, error, refetch } = useQuery(inviteCodesQueryOptions())
  const issue = useIssueInviteCode()
  const revoke = useRevokeInviteCode()

  const [preset, setPreset] = useState<Preset>('one_time')
  const [hours, setHours] = useState<number>(VALUES.invite.timedPresetHours[0])
  const [label, setLabel] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null)

  function submit() {
    const input: IssueInput = { label: label.trim() }
    if (preset === 'one_time') input.maxUses = 1
    if (preset === 'timed') input.ttlSeconds = BigInt(hours) * 3600n
    issue.mutate(input, { onSuccess: () => setLabel('') })
  }

  async function copy(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      /* 클립보드 거부(권한·비보안 컨텍스트) — 조용히 무시. */
    }
  }

  // 초대 URL 복사(change 05) — `${origin}/invite?code=<code>`. 코드 문자열 복사와 별개 상태.
  async function copyUrl(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code))
      setCopiedUrlId(id)
      window.setTimeout(() => setCopiedUrlId((c) => (c === id ? null : c)), 1500)
    } catch {
      /* 무시 */
    }
  }

  // 초대 URL 공유 — Web Share API(있으면 OS 공유 시트). 사용자가 취소하면 그대로 두고, 미지원·실패면 복사 폴백.
  async function shareUrl(code: string, id: string) {
    if (CAN_SHARE) {
      try {
        await navigator.share({ title: 'cosimosi 초대', text: '초대장을 보내요.', url: inviteUrl(code) })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return // 사용자가 취소 — 폴백하지 않음
        /* 그 외 실패 → 복사 폴백 */
      }
    }
    await copyUrl(code, id)
  }

  return (
    <div className="space-y-6">
      {/* 발행 */}
      <GlassCard className="space-y-4 p-5">
        <h2 className="text-base font-light tracking-wide">초대 코드 발행</h2>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={[
                'rounded-lg border px-3 py-2 text-left transition',
                preset === p.value
                  ? 'border-indigo-300/50 bg-indigo-400/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10',
              ].join(' ')}
            >
              <span className="block text-sm text-white/90">{p.label}</span>
              <span className="block text-xs text-white/40">{p.hint}</span>
            </button>
          ))}
        </div>

        {preset === 'timed' && (
          <label className="flex items-center gap-2 text-sm text-white/70">
            유효 기간
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 focus:border-white/30 focus:outline-none"
            >
              {VALUES.invite.timedPresetHours.map((h) => (
                <option key={h} value={h} className="bg-[#0b0b1c]">
                  {fmtHours(h)}
                </option>
              ))}
            </select>
          </label>
        )}

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="라벨/메모 (선택) — 예: 지인 배포, X 행사용"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={issue.isPending}
          className={`${primaryButtonCls} disabled:opacity-50`}
        >
          {issue.isPending ? '발행 중…' : '코드 발행'}
        </button>
        {issue.isError && (
          <p className="text-xs text-red-300/80">발행에 실패했어요. 잠시 후 다시 시도해 주세요.</p>
        )}
      </GlassCard>

      {/* 발행 목록 */}
      <section className="space-y-3">
        <h2 className="text-base font-light tracking-wide">발행된 코드</h2>

        {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}
        {isError && <ErrorNotice error={error} onRetry={() => void refetch()} />}

        {data && data.codes.length === 0 && (
          <p className="text-sm text-white/40">아직 발행된 코드가 없어요.</p>
        )}

        {data && data.codes.length > 0 && (
          <div className="space-y-2">
            {data.codes.map((c) => (
              <InviteRow
                key={c.id}
                code={c}
                copied={copiedId === c.id}
                urlCopied={copiedUrlId === c.id}
                canShare={CAN_SHARE}
                onCopy={() => void copy(c.code, c.id)}
                onCopyUrl={() => void copyUrl(c.code, c.id)}
                onShare={() => void shareUrl(c.code, c.id)}
                onRevoke={() => revoke.mutate(c.id)}
                revoking={revoke.isPending && revoke.variables === c.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InviteRow({
  code,
  copied,
  urlCopied,
  canShare,
  onCopy,
  onCopyUrl,
  onShare,
  onRevoke,
  revoking,
}: {
  code: InviteCode
  copied: boolean
  urlCopied: boolean
  canShare: boolean
  onCopy: () => void
  onCopyUrl: () => void
  onShare: () => void
  onRevoke: () => void
  revoking: boolean
}) {
  const status = STATUS_META[code.status] ?? STATUS_META[InviteCodeStatus.UNSPECIFIED]
  const revoked = code.status === InviteCodeStatus.REVOKED
  const uses = code.maxUses === 0 ? `${code.usedCount} / ∞` : `${code.usedCount} / ${code.maxUses}`

  return (
    <GlassCard className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
      <code className="font-mono tracking-[0.15em] text-white/90">{code.code}</code>
      <span className={`text-xs ${status.cls}`}>{status.label}</span>
      <span className="text-xs text-white/50">사용 {uses}</span>
      <span className="text-xs text-white/40">만료 {fmtDate(code.expiresAt)}</span>
      {code.label && <span className="text-xs text-white/60">“{code.label}”</span>}
      <span className="ml-auto text-xs text-white/30" title={code.createdBy}>
        발행 {code.createdBy.slice(0, 8)}…
      </span>
      <button type="button" onClick={onCopy} className={`${ghostButtonCls} px-2.5 py-1 text-xs`}>
        {copied ? '복사됨' : '코드'}
      </button>
      <button type="button" onClick={onCopyUrl} className={`${ghostButtonCls} px-2.5 py-1 text-xs`}>
        {urlCopied ? '복사됨' : 'URL'}
      </button>
      {canShare && (
        <button type="button" onClick={onShare} className={`${ghostButtonCls} px-2.5 py-1 text-xs`}>
          공유
        </button>
      )}
      {!revoked && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className={`${ghostButtonCls} px-2.5 py-1 text-xs text-red-300/80 disabled:opacity-50`}
        >
          취소
        </button>
      )}
    </GlassCard>
  )
}
