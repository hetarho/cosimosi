// SpecPreviewPage — a dev-only sandbox to eyeball what each spec built.
//
// Sidebar lists every spec; clicking one shows its panel. FE/FS specs get an
// interactive preview (form → real RPC → rendered result); BE/Infra specs that
// have no UI show a short architecture summary instead (see /spec-preview
// convention in spec/plan/00.overview.md). Mounted only in dev (router.tsx).
import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Code, ConnectError, createClient, type Interceptor } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { getAccessToken, memoryClient } from '@/shared/api'
import { MemoryService, Mood, type GetUniverseResponse } from '@/shared/api/gen/cosimosi/v1/memory_pb'

type Scope = 'FE' | 'BE' | 'FS' | 'Infra'

interface SpecEntry {
  num: string
  title: string
  scope: Scope
  done: boolean
  Panel: ComponentType
}

// --- small shared bits ---

function errText(e: unknown): string {
  const ce = ConnectError.from(e)
  return `${Code[ce.code]}: ${ce.message}`
}

/** Reads the `alg` from a JWT header (base64url) without verifying. */
function jwtAlg(token: string): string {
  try {
    const h = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(h)) as { alg?: string }).alg ?? '?'
  } catch {
    return '?'
  }
}

/** A Connect client that attaches a pasted dev token (bypasses Supabase). */
function makeDevClient(token: string) {
  const auth: Interceptor = (next) => (req) => {
    req.header.set('Authorization', `Bearer ${token}`)
    return next(req)
  }
  const baseUrl = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL ?? '')
  return createClient(MemoryService, createConnectTransport({ baseUrl, interceptors: [auth] }))
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-white/50">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none focus:border-white/30'

// --- 01 sign-in ---

function Spec01Panel() {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const alg = token ? jwtAlg(token) : ''
  return (
    <div className="space-y-4">
      <p className="text-white/70">
        Supabase 이메일 OTP + Google OAuth 로그인. 세션이 있으면 Connect 호출 시 토큰이 자동으로 실립니다.
      </p>
      <button
        className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        onClick={() => {
          setCopied(false)
          void getAccessToken().then(setToken)
        }}
      >
        현재 세션 토큰 확인
      </button>
      {token === null && (
        <p className="text-sm text-amber-400">
          로그인 안 됨 (토큰 없음). /universe 에서 로그인하면 여기 토큰이 뜹니다.
        </p>
      )}
      {token && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-emerald-400">로그인됨 — access token</span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">alg: {alg}</span>
            <button
              className="rounded-md bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              onClick={() => {
                void navigator.clipboard.writeText(token)
                setCopied(true)
              }}
            >
              {copied ? '복사됨 ✓' : '전체 복사'}
            </button>
          </div>
          <textarea
            readOnly
            value={token}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputCls} h-28 w-full font-mono text-xs`}
          />
          {alg !== 'HS256' && (
            <p className="text-xs text-amber-300/90">
              ⚠ 이 토큰은 <b>{alg}</b>(비대칭) 서명이에요. MVP 백엔드는 <b>HS256</b>만 검증하므로 이 토큰을
              04에 붙여도 거부돼요. BE 테스트는 04 패널의 <b>dev 토큰</b>(HS256)을 쓰세요.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --- 02 rpc-contract (architecture) ---

function Spec02Panel() {
  return (
    <div className="space-y-3 text-white/70">
      <p>백엔드성 스펙이라 인터랙티브 화면은 04에서 보입니다. 구조 요약:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          단일 <code className="text-white/90">MemoryService</code> (proto,{' '}
          <code className="text-white/90">cosimosi.v1</code>) — 모든 RPC는 <b>unary</b>(스트리밍 없음, RN
          호환).
        </li>
        <li>Connect 서버(h2c + CORS) + 인터셉터 체인: 로깅(바깥) → 인증(안). /health 는 우회.</li>
        <li>
          인증: Supabase JWT(HS256) 검증 → <code className="text-white/90">sub</code> 를 user_id 로 주입.
          토큰 없거나 무효면 <code className="text-white/90">Unauthenticated</code>.
        </li>
        <li>
          전송: 프론트는 <code className="text-white/90">/api</code>(Vite 프록시) → 백엔드. 생성된 TS
          클라이언트(<code className="text-white/90">memoryClient</code>)가 토큰을 자동 첨부.
        </li>
      </ul>
      <p className="text-sm text-white/40">흐름: 브라우저 → Connect(JSON/proto) → 인터셉터(인증) → 핸들러.</p>
    </div>
  )
}

// --- 03 data-schema (architecture) ---

function Spec03Panel() {
  return (
    <div className="space-y-3 text-white/70">
      <p>DB 스키마(영속 계층). 화면 없음 — 6개 테이블 + pgvector. 3겹 분리:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <b>records</b> — 원본 일기(불변·영구). UPDATE/DELETE 없음.
        </li>
        <li>
          <b>memories</b> — 별(가변). <code className="text-white/90">record_id</code>로 원본 참조.
        </li>
        <li>
          <b>embeddings</b> — 의미 벡터 <code className="text-white/90">vector(1536)</code> + HNSW 색인
          (유사 기억 검색).
        </li>
        <li>
          <b>memory_links</b> — 시냅스(가중치 그래프, a&lt;b 정규화). 삭제 안 함.
        </li>
        <li>
          <b>jobs</b> — 비동기 큐(임베딩 작업). <b>processed_batches</b> — 회상 강화 멱등.
        </li>
      </ul>
      <p className="text-sm text-white/40">
        헌법: 원본 불변 · 별/시냅스 행 삭제 금지(감쇠는 밝기만) · 좌표는 클라에서 창발.
      </p>
    </div>
  )
}

// --- 04 memory-api (interactive) ---

const MOODS: { label: string; value: Mood }[] = [
  { label: '(없음)', value: Mood.MOOD_UNSPECIFIED },
  { label: '기쁨 JOY', value: Mood.JOY },
  { label: '평온 CALM', value: Mood.CALM },
  { label: '슬픔 SAD', value: Mood.SAD },
  { label: '분노 ANGER', value: Mood.ANGER },
  { label: '두려움 FEAR', value: Mood.FEAR },
  { label: '사랑 LOVE', value: Mood.LOVE },
  { label: '중립 NEUTRAL', value: Mood.NEUTRAL },
]

function Spec04Panel() {
  const [devToken, setDevToken] = useState('')
  const client = useMemo(
    () => (devToken.trim() ? makeDevClient(devToken.trim()) : memoryClient),
    [devToken],
  )

  const [body, setBody] = useState('오늘 첫 번째 별을 만들었다')
  const [mood, setMood] = useState<Mood>(Mood.JOY)
  const [intensity, setIntensity] = useState(0.8)
  const [entryDate, setEntryDate] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')

  const [memoryId, setMemoryId] = useState('')
  const [universe, setUniverse] = useState<GetUniverseResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function record() {
    setError('')
    setBusy(true)
    try {
      const res = await client.recordMemory({ body, mood, intensity, entryDate, idempotencyKey })
      setMemoryId(res.memoryId)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  async function fetchUniverse() {
    setError('')
    setBusy(true)
    try {
      setUniverse(await client.getUniverse({}))
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <details className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
        <summary className="cursor-pointer text-white/60">고급: dev 토큰 (Supabase 미로그인 시)</summary>
        <p className="mt-2 text-white/40">
          백엔드 <code>SUPABASE_JWT_SECRET</code>로 서명한 토큰을 붙여넣으면 그걸로 호출합니다. 비우면
          현재 Supabase 세션 토큰을 사용합니다.
        </p>
        <textarea
          className={`${inputCls} mt-2 h-20 w-full font-mono text-xs`}
          placeholder="eyJ… (HS256 dev JWT)"
          value={devToken}
          onChange={(e) => setDevToken(e.target.value)}
        />
        {devToken.trim() && jwtAlg(devToken.trim()) !== 'HS256' && (
          <p className="mt-2 text-xs text-red-300">
            ⚠ 이 토큰은 <b>{jwtAlg(devToken.trim())}</b> 서명이에요. 백엔드는 <b>HS256</b>만 받습니다 — 01의
            Supabase 토큰(ES256)은 여기 쓸 수 없어요. HS256 dev 토큰을 넣으세요.
          </p>
        )}
      </details>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">RecordMemory — 일기 기록</h3>
        <Field label="body (일기 본문)">
          <textarea className={`${inputCls} h-24`} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="mood">
            <select
              className={inputCls}
              value={String(mood)}
              onChange={(e) => setMood(Number(e.target.value) as Mood)}
            >
              {MOODS.map((m) => (
                <option key={m.value} value={String(m.value)}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`intensity: ${intensity.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </Field>
          <Field label="entry_date (비우면 오늘)">
            <input
              type="date"
              className={inputCls}
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </Field>
          <Field label="idempotency_key (선택)">
            <input
              className={inputCls}
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              placeholder="같은 키 두 번 → 같은 별"
            />
          </Field>
        </div>
        <button
          className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          onClick={() => void record()}
          disabled={busy}
        >
          기록하기 (RecordMemory)
        </button>
        {memoryId && (
          <p className="text-sm text-emerald-400">
            ✓ 새 별 memory_id = <span className="font-mono">{memoryId}</span>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">GetUniverse — 우주 조회</h3>
        <button
          className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
          onClick={() => void fetchUniverse()}
          disabled={busy}
        >
          우주 불러오기 (GetUniverse)
        </button>
        {universe && (
          <div className="space-y-3 text-sm">
            <div className="text-white/50">
              별 {universe.stars.length}개 · 시냅스 {universe.synapses.length}개
            </div>
            <div className="overflow-hidden rounded-md border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-white/50">
                  <tr>
                    <th className="px-3 py-2">memory_id</th>
                    <th className="px-3 py-2">mood</th>
                    <th className="px-3 py-2">intensity</th>
                    <th className="px-3 py-2">last_recalled_at</th>
                  </tr>
                </thead>
                <tbody>
                  {universe.stars.map((s) => (
                    <tr key={s.memoryId} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono">{s.memoryId.slice(0, 10)}…</td>
                      <td className="px-3 py-2">{Mood[s.mood]}</td>
                      <td className="px-3 py-2">{s.intensity.toFixed(2)}</td>
                      <td className="px-3 py-2 text-white/50">{s.lastRecalledAt}</td>
                    </tr>
                  ))}
                  {universe.stars.length === 0 && (
                    <tr>
                      <td className="px-3 py-2 text-white/40" colSpan={4}>
                        별이 없습니다 — 위에서 먼저 기록해 보세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-white/40">
              시냅스는 05(embedding-worker)에서 의미 유사도로 생성됩니다 — 04만으로는 비어 있는 게 정상.
            </p>
          </div>
        )}
      </section>

      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">⚠ {error}</p>}
    </div>
  )
}

// --- not-yet-built specs: planned-feature placeholder ---

function future(desc: string): ComponentType {
  return function FuturePanel() {
    return (
      <div className="space-y-2 text-white/60">
        <p className="text-amber-400/80">🔒 아직 구현 전</p>
        <p>예정 기능: {desc}</p>
        <p className="text-sm text-white/40">구현되면 이 패널에 프리뷰(또는 아키텍처 설명)가 채워집니다.</p>
      </div>
    )
  }
}

const SPECS: SpecEntry[] = [
  { num: '01', title: 'sign-in — Supabase Auth', scope: 'FE', done: true, Panel: Spec01Panel },
  { num: '02', title: 'rpc-contract — Connect 서버·전송·인증', scope: 'FS', done: true, Panel: Spec02Panel },
  { num: '03', title: 'data-schema — pgvector·goose·sqlc', scope: 'BE', done: true, Panel: Spec03Panel },
  { num: '04', title: 'memory-api — RecordMemory·GetUniverse', scope: 'BE', done: true, Panel: Spec04Panel },
  { num: '05', title: 'embedding-worker', scope: 'BE', done: false, Panel: future('임베딩 생성 워커 + 의미 유사 top-k 연결(시냅스) 생성. jobs 큐 소비.') },
  { num: '06', title: 'universe-canvas', scope: 'FE', done: false, Panel: future('WebGPU 캔버스 · Bloom · 카메라 컨트롤.') },
  { num: '07', title: 'force-sim', scope: 'FE', done: false, Panel: future('Barnes-Hut 힘 시뮬레이션 tick + Worker(별 좌표 창발).') },
  { num: '08', title: 'star-rendering', scope: 'FE', done: false, Panel: future('별 인스턴싱 렌더(InstancedMesh + TSL 셰이더).') },
  { num: '09', title: 'synapse-rendering', scope: 'FE', done: false, Panel: future('시냅스 연결선 렌더(Line2 + TSL).') },
  { num: '10', title: 'record-memory-ui', scope: 'FE', done: false, Panel: future('작성 폼 → 별 등장(수직 슬라이스, 04 API 연동).') },
  { num: '11', title: 'recall-reinforce', scope: 'FS', done: false, Panel: future('회상 · 공동 회상 강화(weight 증가, last_*_at 갱신).') },
  { num: '12', title: 'decay-dormant', scope: 'FS', done: false, Panel: future('활성도 감쇠 · 최소 밝기 · 잠든 별 탐색.') },
  { num: '13', title: 'mvp-verification', scope: 'FS', done: false, Panel: future('pnpm dev 전체 한 바퀴 · E2E · 에러 점검.') },
  { num: '14', title: 'deploy-cicd', scope: 'Infra', done: false, Panel: future('develop→스테이징 · main→프로덕션 자동 배포.') },
]

const scopeColor: Record<Scope, string> = {
  FE: 'text-sky-300',
  BE: 'text-emerald-300',
  FS: 'text-violet-300',
  Infra: 'text-amber-300',
}

export function SpecPreviewPage() {
  const [sel, setSel] = useState(3) // default: 04 (the first interactive one)
  const active = SPECS[sel]
  const Panel = active.Panel

  return (
    <div className="flex min-h-screen w-full bg-neutral-950 text-white/90">
      <aside className="sticky top-0 h-screen w-72 shrink-0 overflow-y-auto border-r border-white/10 p-4">
        <h1 className="text-lg font-light tracking-wide">Spec Preview</h1>
        <p className="mt-1 mb-4 text-xs text-white/40">각 스펙이 만든 기능 미리보기 · dev 전용</p>
        <nav className="space-y-1">
          {SPECS.map((s, i) => (
            <button
              key={s.num}
              onClick={() => setSel(i)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                i === sel ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <span className="font-mono text-xs text-white/40">{s.num}</span>
              <span className="flex-1 truncate">{s.title.split(' — ')[0]}</span>
              <span className={`text-[10px] ${scopeColor[s.scope]}`}>{s.scope}</span>
              <span className="text-[10px]">{s.done ? '✅' : '⬜'}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-6 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-white/40">{active.num}</span>
            <h2 className="text-xl font-light">{active.title}</h2>
            <span className={`text-xs ${scopeColor[active.scope]}`}>{active.scope}</span>
          </div>
        </header>
        <Panel />
      </main>
    </div>
  )
}
