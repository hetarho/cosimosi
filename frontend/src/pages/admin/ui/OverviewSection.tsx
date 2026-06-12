// 운영 대시보드(spec 34): 합계 카드 4 + 잡 큐 + 30일 스파크라인 + LLM 토큰/추정 비용.
// Sentry(에러)·PostHog(행동)와 겹치지 않는 비즈니스/AI 비용 뷰만 담는다.
// 차트 라이브러리 없이 경량 인라인 SVG — 관리자 1인용 화면에 의존성을 들이지 않는다.
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/shared/ui'
import type { DayCount, UsageRow } from '@/shared/api'
import { adminOverviewQueryOptions } from '../api/admin-queries'
import { ErrorNotice } from './ErrorNotice'
import { estimateCostUSD, formatUSD } from '../lib/pricing'

export function OverviewSection() {
  const { data, isPending, isError, error, refetch } = useQuery(adminOverviewQueryOptions())

  if (isPending) return <p className="text-sm text-white/40">대시보드 불러오는 중…</p>
  if (isError) return <ErrorNotice error={error} onRetry={() => void refetch()} />

  const totals: { label: string; value: bigint }[] = [
    { label: '사용자', value: data.users },
    { label: '일기', value: data.records },
    { label: '별', value: data.memories },
    { label: '시냅스', value: data.synapses },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-base font-light tracking-wide">대시보드</h2>

      {/* 합계 4종 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map((t) => (
          <GlassCard key={t.label} className="p-4 text-center">
            <p className="text-2xl font-light">{t.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/40">{t.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* 잡 큐 건강 */}
      <GlassCard className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="text-xs text-white/40">잡 큐</span>
        <span className="text-white/70">대기 {data.jobsPending.toLocaleString()}</span>
        <span className="text-white/70">처리 중 {data.jobsProcessing.toLocaleString()}</span>
        <span className={data.jobsFailed > 0n ? 'text-red-300' : 'text-white/70'}>
          실패 {data.jobsFailed.toLocaleString()}
        </span>
        <span className="text-white/70">24h 완료 {data.jobsDone24h.toLocaleString()}</span>
      </GlassCard>

      {/* 30일 일기 스파크라인 */}
      <GlassCard className="space-y-2 p-4">
        <p className="text-xs text-white/40">최근 30일 일기</p>
        <RecordSparkline series={data.recordSeries} />
      </GlassCard>

      {/* LLM 토큰 사용 + 추정 비용 */}
      <GlassCard className="space-y-3 p-4">
        <p className="text-xs text-white/40">
          LLM 토큰 사용 (최근 30일) · 비용은 정적 단가표 기준 <em>추정</em>
        </p>
        <UsageTable usage={data.llmUsage} />
      </GlassCard>
    </section>
  )
}

/** 인라인 SVG 스파크라인 — 일자 빈칸은 0으로 채워 30칸 고정 폭으로 그린다. */
function RecordSparkline({ series }: { series: DayCount[] }) {
  const days = 30
  const byDay = new Map(series.map((d) => [d.day, Number(d.count)]))
  // 시리즈의 마지막 날(없으면 오늘) 기준으로 30일 창을 만든다.
  const end = series.length > 0 ? new Date(series[series.length - 1].day) : new Date()
  const counts: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    counts.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0)
  }
  const max = Math.max(1, ...counts)
  const w = 300
  const h = 48
  const barW = w / days

  if (counts.every((c) => c === 0)) {
    return <p className="text-xs text-white/25">아직 데이터가 없어요.</p>
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" role="img" aria-label="최근 30일 일기 수">
      {counts.map((c, i) => {
        const barH = (c / max) * (h - 4)
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={h - barH}
            width={barW - 2}
            height={barH}
            rx={1}
            className="fill-indigo-400/70"
          />
        )
      })}
    </svg>
  )
}

/** 공급자/모델별 토큰 합계 + 추정 비용 바. */
function UsageTable({ usage }: { usage: UsageRow[] }) {
  if (usage.length === 0) {
    return <p className="text-xs text-white/25">아직 LLM 사용 기록이 없어요.</p>
  }

  // day×kind를 (provider, model)로 합산해 모델별 한 줄로 보여준다.
  const byModel = new Map<string, { provider: string; model: string; calls: bigint; input: bigint; output: bigint }>()
  for (const row of usage) {
    const key = `${row.provider}/${row.model}`
    const agg = byModel.get(key) ?? {
      provider: row.provider,
      model: row.model,
      calls: 0n,
      input: 0n,
      output: 0n,
    }
    agg.calls += row.calls
    agg.input += row.inputTokens
    agg.output += row.outputTokens
    byModel.set(key, agg)
  }
  const rows = [...byModel.values()]
  const maxTokens = rows.reduce((m, r) => {
    const t = Number(r.input + r.output)
    return t > m ? t : m
  }, 1)

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const total = Number(r.input + r.output)
        const cost = estimateCostUSD(r.model, Number(r.input), Number(r.output))
        return (
          <li key={`${r.provider}/${r.model}`} className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
              <span className="text-white/80">
                {r.provider}/{r.model}
              </span>
              <span className="text-white/40">
                {r.calls.toLocaleString()}회 · in {r.input.toLocaleString()} · out{' '}
                {r.output.toLocaleString()}
              </span>
              {cost !== null && <span className="ml-auto text-white/60">{formatUSD(cost)} 추정</span>}
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-cyan-400/60"
                style={{ width: `${Math.max(2, (total / maxTokens) * 100)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
