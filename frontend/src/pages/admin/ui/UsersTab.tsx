// 사용자 탭(spec 46) — 전체 사용자 목록 + user_id 검색 + 별가루 보정 지급. 운영 최소 표면이라
// 삭제·정지·이력 조회·이메일 검색은 넣지 않는다(비목표). 목록은 keyset 페이지네이션(다음 페이지 전진),
// 검색은 서버 user_id 부분 일치. 지급은 행별 양의 정수 amount → GrantUserStardust(서버 트랜잭션).
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard, ghostButtonCls, primaryButtonCls } from '@/shared/ui'
import { adminUsersQueryOptions, useGrantUserStardust } from '../api/admin-queries'
import { ErrorNotice } from './ErrorNotice'

export function UsersTab() {
  // 입력 검색어(타이핑) vs 적용된 검색어(서버로 보낸 것) — 검색 버튼/Enter로만 커밋한다.
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [pageToken, setPageToken] = useState('')

  const { data, isPending, isError, error, refetch } = useQuery(
    adminUsersQueryOptions({ userIdQuery: query, pageToken }),
  )

  function submitSearch() {
    setPageToken('') // 새 검색은 첫 페이지부터
    setQuery(draft.trim())
  }

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4 p-5">
        <h2 className="text-base font-light tracking-wide">사용자</h2>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch()
            }}
            placeholder="user_id 검색 (부분 일치, 대소문자 무시)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          <button type="button" onClick={submitSearch} className={`${ghostButtonCls} shrink-0 px-4`}>
            검색
          </button>
        </div>
      </GlassCard>

      <section className="space-y-3">
        {isPending && <p className="text-sm text-white/40">불러오는 중…</p>}
        {isError && <ErrorNotice error={error} onRetry={() => void refetch()} />}

        {data && data.users.length === 0 && (
          <p className="text-sm text-white/40">
            {query ? '검색 결과가 없어요.' : '아직 사용자가 없어요.'}
          </p>
        )}

        {data && data.users.length > 0 && (
          <div className="space-y-2">
            {data.users.map((u) => (
              <UserRow key={u.userId} userId={u.userId} stardust={u.stardust} walletSeeded={u.walletSeeded} />
            ))}
          </div>
        )}

        {data && data.nextPageToken !== '' && (
          <button
            type="button"
            onClick={() => setPageToken(data.nextPageToken)}
            className={`${ghostButtonCls} px-4 py-2 text-sm`}
          >
            다음 페이지
          </button>
        )}
      </section>
    </div>
  )
}

function UserRow({
  userId,
  stardust,
  walletSeeded,
}: {
  userId: string
  stardust: bigint
  walletSeeded: boolean
}) {
  const grant = useGrantUserStardust()
  const [amount, setAmount] = useState('')

  // 양의 정수 문자열만 허용(앞자리 0·소수점·공백·지수표기 거부). 문자열→BigInt로 정밀 손실 없이
  // 변환하고(아주 큰 수도 정확), 상한(INT4) 검증은 서버가 한다. Number()는 '1.0'·정밀손실을 흘려보낸다.
  const trimmed = amount.trim()
  const valid = /^[1-9][0-9]*$/.test(trimmed)

  function submit() {
    if (!valid) return
    grant.mutate(
      { targetUserId: userId, amount: BigInt(trimmed) },
      { onSuccess: () => setAmount('') },
    )
  }

  return (
    <GlassCard className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
      <code className="font-mono text-xs text-white/90">{userId}</code>
      <span className="text-xs text-white/60">⭐ {stardust.toString()}</span>
      <span className={`text-xs ${walletSeeded ? 'text-emerald-300/80' : 'text-white/40'}`}>
        {walletSeeded ? '지갑 시드됨' : '미시드'}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          inputMode="numeric"
          placeholder="지급액"
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!valid || grant.isPending}
          className={`${primaryButtonCls} px-3 py-1.5 text-xs disabled:opacity-40`}
        >
          {grant.isPending && grant.variables?.targetUserId === userId ? '지급 중…' : '별가루 지급'}
        </button>
      </div>
      {grant.isError && grant.variables?.targetUserId === userId && (
        <p className="w-full text-xs text-red-300/80">지급에 실패했어요. 잠시 후 다시 시도해 주세요.</p>
      )}
    </GlassCard>
  )
}
