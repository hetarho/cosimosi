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
import {
  MemoryService,
  Mood,
  type GetUniverseResponse,
  type Star,
} from '@/shared/api/gen/cosimosi/v1/memory_pb'
import {
  alpha as simAlpha,
  createSim,
  isSettled,
  positions,
  tick,
  type SimGraph,
} from '@/shared/lib/force-sim'
import { Canvas, type GLProps } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { createRenderer } from '@/shared/lib/r3f'
import { StarField } from '@/entities/star'
import {
  activation,
  isDormant,
  seedFromId,
  starBrightness,
  synapseBrightness,
  useMemoryStore,
  type Mood as StarMood,
  type StarNode,
} from '@/entities/memory'
import { SynapseLines, type SynapseEdge } from '@/entities/synapse'

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

// --- 05 embedding-worker (architecture) ---

function Spec05Panel() {
  return (
    <div className="space-y-3 text-white/70">
      <p>
        비동기 워커(백엔드성 스펙). 04가 일기 저장 시 <code className="text-white/90">jobs</code> 큐에 적재한
        작업을 소비해 임베딩과 시냅스를 만듭니다. 04 패널에서 일기를 2건 기록한 뒤 GetUniverse를 다시 부르면
        시냅스(edges)가 채워집니다. 파이프라인:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <b>claim</b> — <code className="text-white/90">FOR UPDATE SKIP LOCKED</code>로 due 상태
          <code className="text-white/90">pending</code> job 1건을 원자적으로 잠그고 running 표시(동시 워커 안전).
        </li>
        <li>
          <b>embed</b> — AI 포트(원칙7) 뒤의 어댑터. <code className="text-white/90">AI_EMBEDDER=mock</code>는
          키 없이 텍스트 해시 시드의 결정론적 1536차원 벡터, <code className="text-white/90">openai</code>는
          text-embedding-3-small. 결과를 <code className="text-white/90">embeddings</code>(pgvector)에 업서트.
        </li>
        <li>
          <b>link</b> — KNN top-8 중 <code className="text-white/90">cos_sim ≥ 0.75</code> 후보(같은 user_id,
          자기 제외)에 <code className="text-white/90">w0 = clamp(α·cos_sim + temporal_bonus, 0, 1)</code>(α=1,
          같은 주 +0.3 선형 감소)로 가중치 계산 → <code className="text-white/90">memory_links</code> UNNEST 배치
          업서트(무방향 a&lt;b 정규화는 DB 콜레이션과 일치하도록 <code className="text-white/90">LEAST/GREATEST</code>).
        </li>
        <li>
          <b>실패</b> — 지수 백오프(<code className="text-white/90">next_run_at = now + base·2^attempts</code>)로
          재시도, 한계 도달 시 <code className="text-white/90">failed</code>로 보존(삭제 안 함). 별·원본 일기 불변.
        </li>
      </ul>
      <p className="text-sm text-white/40">
        멱등: 임베딩 업서트 + 링크 <code>GREATEST</code> 업서트라 재실행이 안전. 좌표는 저장하지 않음(클라
        force-sim 권위, 원칙3). mock은 의미가 아니라 안정성만 모델 — 동일 본문이어야 링크가 생깁니다.
      </p>
    </div>
  )
}

// --- 06 universe-canvas (architecture; live preview is the /universe route) ---

function Spec06Panel() {
  return (
    <div className="space-y-3 text-white/70">
      <p>
        WebGPU 우주 캔버스 셸. 실제 화면은{' '}
        <a href="/universe" className="text-sky-300 underline">
          /universe
        </a>{' '}
        라우트에서 전체 화면으로 동작합니다(로그인 필요). 구조:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          R3F <code className="text-white/90">&lt;Canvas&gt;</code> + three{' '}
          <code className="text-white/90">WebGPURenderer</code>(비동기 init, WebGPU 미지원 시 WebGL2 자동
          폴백 — <code className="text-white/90">forceWebGL</code>로 폴백 경고 회피).
        </li>
        <li>
          노드 기반 Bloom(<code className="text-white/90">RenderPipeline</code> +{' '}
          <code className="text-white/90">bloom</code> TSL) — <code className="text-white/90">useFrame</code>{' '}
          priority로 렌더 소유.
        </li>
        <li>짙은 남색 배경 + 별 먼지(Points) + 실제 별(08 StarField, 스토어 기반 — 10에서 결선).</li>
        <li>카메라 모드 nebula(줌 제한)/recall(자유) — 우상단 HUD 토글로 전환.</li>
        <li>
          렌더러 격리: <code className="text-white/90">shared/lib/r3f/types.ts</code>는 three/React 미의존
          (모바일 재사용, 원칙4). 언마운트 시 렌더러 dispose.
        </li>
      </ul>
      <p className="text-sm text-white/40">별/시냅스 실제 렌더는 08·09, 별 좌표(force-sim)는 07.</p>
    </div>
  )
}

// --- 07 force-sim (interactive: run the layout, watch it converge) ---

const FORCE_DEMO: SimGraph = {
  // 4 existing (pinned) stars + 1 new star linked strongly to p1, weakly to p2.
  // Free set = {new} ∪ 1-hop {p1, p2}; p3/p4 stay fixed (partial placement). The new
  // star should settle closer to its STRONG neighbor (p1) than its weak one (p2).
  nodes: [
    { id: 'p1', pinned: true, x: -55, y: -20, z: 0 },
    { id: 'p2', pinned: true, x: 60, y: -10, z: 0 },
    { id: 'p3', pinned: true, x: 15, y: 60, z: 0 },
    { id: 'p4', pinned: true, x: -35, y: 50, z: 0 },
    { id: 'new', pinned: false, x: 0, y: 0, z: 0 },
  ],
  edges: [
    { source: 'new', target: 'p1', weight: 1.0 },
    { source: 'new', target: 'p2', weight: 0.25 },
  ],
}

// id → node index (stable module constant; FORCE_DEMO never changes).
const FORCE_DEMO_IDX = new Map(FORCE_DEMO.nodes.map((nd, i) => [nd.id, i] as const))

function Spec07Panel() {
  // sim is created once and mutated in place by tick(); `pos` (a fresh copy each
  // step) is the state that actually drives re-renders. No refs (the React 19 lint
  // forbids reading refs during render).
  const [sim, setSim] = useState(() => createSim(FORCE_DEMO))
  const [pos, setPos] = useState<Float32Array>(() => positions(sim))
  const [a, setA] = useState(() => simAlpha(sim))
  const [settled, setSettled] = useState(false)

  const reset = () => {
    const s = createSim(FORCE_DEMO)
    setSim(s)
    setPos(positions(s))
    setA(simAlpha(s))
    setSettled(false)
  }
  const step = (steps: number) => {
    tick(sim, steps)
    setPos(positions(sim))
    setA(simAlpha(sim))
    setSettled(isSettled(sim))
  }

  // 2D projection (x,y), auto-fit to the viewBox.
  const W = 380
  const H = 240
  const pad = 24
  const nodes = FORCE_DEMO.nodes
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i++) {
    minX = Math.min(minX, pos[i * 3])
    maxX = Math.max(maxX, pos[i * 3])
    minY = Math.min(minY, pos[i * 3 + 1])
    maxY = Math.max(maxY, pos[i * 3 + 1])
  }
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad)
  const sy = (y: number) => pad + ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad)

  return (
    <div className="space-y-4 text-white/70">
      <p>
        별 좌표는 임베딩이 아니라 <b>연결 가중치 그래프의 힘 시뮬레이션</b>에서 창발합니다(원칙3). 순수{' '}
        <code className="text-white/90">tick(dt)</code> 모듈(Barnes-Hut octree, three/React 미의존) — 여기선
        메인 스레드에서 직접 펌프하지만 실제 앱은 Web Worker가 돕습니다. 아래는 기존 별 4개(고정) + 새 별
        1개가 강한 연결(p1, w=1.0)·약한 연결(p2, w=0.25)에 끌려 자리 잡는 데모:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          onClick={() => step(20)}
        >
          tick ×20
        </button>
        <button
          className="rounded-md bg-indigo-500/80 px-3 py-1.5 text-sm hover:bg-indigo-500"
          onClick={() => step(2000)}
        >
          수렴까지
        </button>
        <button
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          onClick={reset}
        >
          리셋
        </button>
        <span className="text-sm text-white/50">
          alpha {a.toFixed(4)} · {settled ? 'settled ✓' : 'running'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-md rounded-md border border-white/10 bg-[#070b1e]"
      >
        {FORCE_DEMO.edges.map((e) => {
          const a0 = FORCE_DEMO_IDX.get(e.source)!
          const b0 = FORCE_DEMO_IDX.get(e.target)!
          return (
            <line
              key={`${e.source}-${e.target}`}
              x1={sx(pos[a0 * 3])}
              y1={sy(pos[a0 * 3 + 1])}
              x2={sx(pos[b0 * 3])}
              y2={sy(pos[b0 * 3 + 1])}
              stroke={e.weight >= 0.8 ? 'rgba(160,180,255,0.9)' : 'rgba(160,180,255,0.3)'}
              strokeWidth={e.weight >= 0.8 ? 2 : 1}
            />
          )
        })}
        {nodes.map((nd, i) => (
          <g key={nd.id}>
            <circle
              cx={sx(pos[i * 3])}
              cy={sy(pos[i * 3 + 1])}
              r={nd.id === 'new' ? 7 : 5}
              fill={nd.id === 'new' ? '#cdb6ff' : nd.pinned ? '#3b5bdb' : '#9fb4ff'}
            />
            <text x={sx(pos[i * 3]) + 9} y={sy(pos[i * 3 + 1]) + 3} fontSize="10" fill="rgba(255,255,255,0.55)">
              {nd.id}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-sm text-white/40">
        파란 별 = 고정(pinned), 보라 별 = 새 별. 수렴 후 새 별은 강연결 p1 쪽에 더 가깝게 자리합니다. p3·p4는
        새 별의 1-hop 밖이라 움직이지 않습니다(부분 배치).
      </p>
    </div>
  )
}

// --- 08 star-rendering (interactive: dummy stars in a single InstancedMesh) ---

const DEMO_MOODS: StarMood[] = ['joy', 'calm', 'sad', 'anger', 'fear', 'love', 'neutral']

/** Deterministic dummy stars: varied mood (color), intensity (size), and age
 *  (brightness). Called from a click handler, so Date.now() is fine here. */
function makeDummyStars(n: number): StarNode[] {
  const now = Date.now()
  const out: StarNode[] = []
  for (let i = 0; i < n; i++) {
    const id = `demo-${i}`
    const ageDays = (i * 53) % 130 // 0..130 days → brightness spread
    out.push({
      id,
      index: i,
      memory: {
        id,
        mood: DEMO_MOODS[i % DEMO_MOODS.length],
        intensity: 0.25 + (((i * 37) % 100) / 100) * 0.75,
        lastRecalledAt: now - ageDays * 86_400_000,
        seed: seedFromId(id),
      },
    })
  }
  return out
}

function Spec08Panel() {
  const stars = useMemoryStore((s) => s.stars)
  const setStars = useMemoryStore((s) => s.setStars)
  return (
    <div className="space-y-4 text-white/70">
      <p>
        기억=별의 순수 도메인 모델 + 시각화. 수천 별을 <b>단일 InstancedMesh</b> 1개로 그리고(원칙8), 별마다
        색=mood·크기=intensity·밝기=activation(시간 감쇠, a_min=0.05 바닥)을 TSL 노드 머티리얼로 반영합니다.
        좌표는 더미(피보나치 구) — 실제 force-sim(07) 연동·데이터 fetch는 10에서.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          onClick={() => setStars(makeDummyStars(300))}
        >
          더미 별 300개
        </button>
        <button
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          onClick={() => setStars(makeDummyStars(800))}
        >
          800개
        </button>
        <button
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
          onClick={() => setStars([])}
        >
          지우기
        </button>
        <span className="text-sm text-white/50">현재 {stars.length}개 · 단일 InstancedMesh</span>
      </div>
      <div className="h-80 w-full overflow-hidden rounded-md border border-white/10" data-lenis-prevent>
        <Canvas
          gl={createRenderer as unknown as GLProps}
          flat
          camera={{ position: [0, 0, 95], fov: 55, near: 0.1, far: 3000 }}
        >
          <color attach="background" args={['#070b1e']} />
          <ambientLight intensity={0.5} />
          <StarField />
          <OrbitControls enableDamping makeDefault />
        </Canvas>
      </div>
      <p className="text-sm text-white/40">
        색=감정, 크기=강도, 밝기=activation 차이가 구분됩니다(Bloom은 /universe 경로에서). 좌표 갱신은
        useFrame 경로로만 — 별 추가/선택 외 React 리렌더 없음(원칙3).
      </p>
    </div>
  )
}

// --- 09 synapse-rendering (interactive: weighted edges as Line2/TSL) ---

const SYN_STARS: Record<string, [number, number, number]> = {
  s0: [0, 32, 0],
  s1: [30, 10, 6],
  s2: [18, -26, -6],
  s3: [-18, -26, 6],
  s4: [-30, 10, -6],
  s5: [0, 0, 28],
}
const synPositionOf = (id: string): [number, number, number] | null => SYN_STARS[id] ?? null

const SYN_EDGES: SynapseEdge[] = [
  { aId: 's0', bId: 's1', weight: 1.0, brightness: 1.0, reinforcedRecency: 0.9, linkType: 'semantic' }, // strong + pulsing
  { aId: 's1', bId: 's2', weight: 0.7, brightness: 0.8, reinforcedRecency: 0, linkType: 'semantic' },
  { aId: 's2', bId: 's3', weight: 0.3, brightness: 0.5, reinforcedRecency: 0, linkType: 'temporal' }, // weak
  { aId: 's3', bId: 's4', weight: 0.1, brightness: 0.05, reinforcedRecency: 0, linkType: 'semantic' }, // dormant (floored)
  { aId: 's4', bId: 's0', weight: 0.85, brightness: 0.9, reinforcedRecency: 0.4, linkType: 'co_recall' }, // strong + mild pulse
  { aId: 's5', bId: 's0', weight: 0.6, brightness: 0.7, reinforcedRecency: 0, linkType: 'entity' },
  { aId: 's5', bId: 'ghost', weight: 1, brightness: 1, reinforcedRecency: 0, linkType: 'semantic' }, // missing endpoint → skipped (1.6)
]

function Spec09Panel() {
  return (
    <div className="space-y-4 text-white/70">
      <p>
        별과 별을 잇는 시냅스(가중치 엣지)를 fat-line(Line2)으로 배칭 렌더. 강도(weight·brightness)를{' '}
        <b>밝기·alpha·펄스</b>로 매핑 — 강한 엣지는 밝고 진하게, 약/잠든 엣지는 어둡지만 a_min 바닥으로 은은히
        잔존(원칙2), 최근 강화된 엣지(reinforcedRecency&gt;0)는 펄스합니다. 두께는 머티리얼 전역 스칼라(per-edge
        변조 불가). 좌표는 props로 받음(좌표 권위는 force-sim).
      </p>
      <div className="h-80 w-full overflow-hidden rounded-md border border-white/10" data-lenis-prevent>
        <Canvas
          gl={createRenderer as unknown as GLProps}
          flat
          camera={{ position: [0, 0, 90], fov: 55, near: 0.1, far: 2000 }}
        >
          <color attach="background" args={['#070b1e']} />
          {Object.entries(SYN_STARS).map(([id, p]) => (
            <mesh key={id} position={p}>
              <sphereGeometry args={[1.6, 16, 16]} />
              <meshBasicMaterial color="#cdb6ff" toneMapped={false} />
            </mesh>
          ))}
          <SynapseLines edges={SYN_EDGES} positionOf={synPositionOf} />
          <OrbitControls enableDamping makeDefault />
        </Canvas>
      </div>
      <p className="text-sm text-white/40">
        7개 엣지 중 강도가 제각각(weight 1.0~0.1)이고 2개는 펄스. 마지막 엣지는 끝점(ghost)이 없어 건너뜀(1.6).
        강화 로직은 11, 감쇠(activation) 산출은 12 — 여기선 받은 값을 시각에 매핑만.
      </p>
    </div>
  )
}

// --- 10 record-memory-ui (live integration; real flow is the /universe route) ---

function Spec10Panel() {
  return (
    <div className="space-y-3 text-white/70">
      <p>
        첫 끝-끝 수직 슬라이스. 실제 흐름은{' '}
        <a href="/universe" className="text-sky-300 underline">
          /universe
        </a>{' '}
        에서 동작합니다(로그인 필요). 04 RPC + 06/08 렌더를 하나의 사용자 흐름으로 잇습니다:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          마운트 시 <code className="text-white/90">GetUniverse</code> 1회 → <code className="text-white/90">stars[]</code>
          를 <code className="text-white/90">StarNode[]</code>로 매핑(map-star: seed=seedFromId·mood 7종·
          last_recalled_at→epoch, <b>좌표 미생성</b>) → 스토어 적재 → StarField 렌더. (synapses 무시 — 09/11.)
        </li>
        <li>
          폼 제출 → 임시 <code className="text-white/90">temp-</code> 별 <b>낙관적 즉시 등장</b>(addStar) →
          <code className="text-white/90">RecordMemory</code> → 성공 시 서버 memory_id로 교체(replaceStar, 기존
          별 위치 유지) / 실패 시 임시 별만 롤백(removeStar) + 한국어 에러. 서버 별은 삭제 안 함(원칙2).
        </li>
        <li>
          새로고침해도 별 잔존(원본 영속, 원칙1). 신규 별의 시냅스는 05 워커가 채운 뒤 <b>다음 GetUniverse
          refetch</b>에서 보임(폴링/스트리밍 아님, 원칙6).
        </li>
        <li>본문·시점은 작성 드래프트에만 보유 — 렌더 스토어(StarNode)에는 안 넣음(원칙1·§2.7).</li>
      </ul>
      <p className="text-sm text-white/40">
        빈 우주(별 0개)면 "첫 일기를 적어 첫 별을 띄워보세요" 안내 + force-sim 0노드 무크래시.
      </p>
    </div>
  )
}

// --- 11 recall-reinforce (interactive: reinforce → idempotent → recall → persist) ---

function Spec11Panel() {
  const [devToken, setDevToken] = useState('')
  const client = useMemo(
    () => (devToken.trim() ? makeDevClient(devToken.trim()) : memoryClient),
    [devToken],
  )

  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [recallId, setRecallId] = useState('')

  const [log, setLog] = useState<string[]>([])
  const [record, setRecord] = useState<Awaited<ReturnType<typeof client.recallMemory>>['record'] | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const addLog = (line: string) => setLog((l) => [line, ...l].slice(0, 8))

  async function reinforce(reuse: boolean) {
    setError('')
    setBusy(true)
    try {
      const id = reuse && batchId ? batchId : crypto.randomUUID()
      setBatchId(id)
      await client.reinforceLinks({ items: [{ aId, bId, deltaWeight: 0.05 }], batchId: id })
      addLog(`ReinforceLinks(+0.05) batch=${id.slice(0, 8)}… ${reuse ? '(재전송)' : ''}`)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  async function recall() {
    setError('')
    setBusy(true)
    setRecord(null)
    try {
      const res = await client.recallMemory({ memoryId: recallId })
      setRecord(res.record ?? null)
      addLog(`RecallMemory(${recallId.slice(0, 8)}…) → last_recalled_at 갱신`)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  async function checkWeight() {
    setError('')
    setBusy(true)
    try {
      const res = await client.getUniverse({})
      const edge = res.synapses.find(
        (s) => (s.aId === aId && s.bId === bId) || (s.aId === bId && s.bId === aId),
      )
      setWeight(edge ? edge.weight : null)
      addLog(`GetUniverse → 페어 weight = ${edge ? edge.weight.toFixed(2) : '(엣지 없음)'}`)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 text-white/70">
      <p>
        회상·공동 회상 강화. 실제 흐름(별 클릭→≥2초 dwell→원본 일기 패널·이웃 항해·디바운스 배치 강화)은{' '}
        <a href="/universe" className="text-sky-300 underline">
          /universe
        </a>{' '}
        에서 동작합니다. 여기선 두 RPC를 직접 호출해 핵심 불변식을 확인합니다(04 패널 GetUniverse 표에서
        memory_id 두 개를 복사해 넣으세요).
      </p>

      <details className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
        <summary className="cursor-pointer text-white/60">고급: dev 토큰 (Supabase 미로그인 시)</summary>
        <textarea
          className={`${inputCls} mt-2 h-20 w-full font-mono text-xs`}
          placeholder="eyJ… (HS256 dev JWT)"
          value={devToken}
          onChange={(e) => setDevToken(e.target.value)}
        />
      </details>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">ReinforceLinks — 공동 회상 강화(증분 +0.05)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="a_id (memory_id)">
            <input className={inputCls} value={aId} onChange={(e) => setAId(e.target.value)} />
          </Field>
          <Field label="b_id (memory_id)">
            <input className={inputCls} value={bId} onChange={(e) => setBId(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            onClick={() => void reinforce(false)}
            disabled={busy || !aId || !bId}
          >
            강화 (새 batch_id)
          </button>
          <button
            className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
            onClick={() => void reinforce(true)}
            disabled={busy || !batchId}
          >
            같은 batch_id 재전송 (멱등 — weight 불변)
          </button>
          <button
            className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
            onClick={() => void checkWeight()}
            disabled={busy || !aId || !bId}
          >
            weight 확인 (GetUniverse)
          </button>
        </div>
        {weight !== null && (
          <p className="text-sm text-emerald-400">
            페어 weight = <span className="font-mono">{weight.toFixed(2)}</span> (강화·재전송 후 재확인 시
            한 번만 가산 = 멱등, 상한 1.0)
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">RecallMemory — 불변 원본 일기(읽기 전용)</h3>
        <Field label="memory_id">
          <input className={inputCls} value={recallId} onChange={(e) => setRecallId(e.target.value)} />
        </Field>
        <button
          className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          onClick={() => void recall()}
          disabled={busy || !recallId}
        >
          회상하기 (RecallMemory)
        </button>
        {record && (
          <article className="space-y-1 rounded-md border border-white/10 bg-white/5 p-3 text-sm">
            <div className="flex gap-2 text-xs text-white/45">
              <span>{record.entryDate}</span>
              <span>·</span>
              <span>{Mood[record.mood]}</span>
              <span>·</span>
              <span>강도 {record.intensity.toFixed(2)}</span>
            </div>
            <p className="whitespace-pre-wrap text-white/85">{record.body}</p>
            <p className="pt-1 text-[10px] text-white/30">
              편집/삭제 컨트롤 없음 — 원본 불변(원칙 1). body는 records JOIN으로 읽음.
            </p>
          </article>
        )}
      </section>

      {log.length > 0 && (
        <div className="rounded-md border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/50">
          {log.map((l, i) => (
            <div key={`${i}-${l}`}>{l}</div>
          ))}
        </div>
      )}
      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">⚠ {error}</p>}
      <p className="text-sm text-white/40">
        검증: 강화 후 weight +0.05 → 같은 batch_id 재전송해도 weight 불변(멱등 1.10) → 새로고침/GetUniverse에도
        유지(영속 1.6). RecallMemory는 last_recalled_at만 갱신하고 원본은 불변(1.2). 감쇠 후 "밝아짐" 렌더는 12.
      </p>
    </div>
  )
}

// --- 12 decay-dormant (interactive: decay model + ListDormant) ---

const DECAY_DAY_MS = 86_400_000

function DecayBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-mono text-white/70">{value.toFixed(3)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-indigo-400/80" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

function Spec12Panel() {
  const [devToken, setDevToken] = useState('')
  const client = useMemo(
    () => (devToken.trim() ? makeDevClient(devToken.trim()) : memoryClient),
    [devToken],
  )
  const [days, setDays] = useState(30)
  const [weight, setWeight] = useState(0.8)
  const [dormant, setDormant] = useState<Star[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Pure model preview: use now=0 and lastRecalledAt=-Δt so activation = exp(-λ·Δt)
  // with no Date.now() in render (react-hooks/purity).
  const t = -days * DECAY_DAY_MS
  const act = activation(t, 0)
  const starB = starBrightness(t, 0)
  const synB = synapseBrightness(weight, t, 0)
  const dormantFlag = isDormant(t, 0)

  async function fetchDormant() {
    setError('')
    setBusy(true)
    try {
      const res = await client.listDormant({})
      setDormant(res.stars)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 text-white/70">
      <p>
        망각 모델: 활성도는 <code className="text-white/90">exp(-λ·Δt)</code>(λ=ln2/30)로 감쇠하되, 별·시냅스
        밝기는 <code className="text-white/90">a_min=0.05</code> 바닥 아래로 내려가지 않아 사라지지 않습니다(원칙 2).
        실제 화면은{' '}
        <a href="/universe" className="text-sky-300 underline">
          /universe
        </a>{' '}
        ·{' '}
        <a href="/dormant" className="text-sky-300 underline">
          /dormant
        </a>
        (로그인 필요).
      </p>

      <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-medium text-white/80">감쇠 시뮬레이터 (순수 model)</h3>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          마지막 회상 후 경과: {days}일
          <input type="range" min={0} max={400} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          시냅스 weight: {weight.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </label>
        <DecayBar label="activation = exp(-λ·Δt) (raw)" value={act} />
        <DecayBar label="별 밝기 = max(a_min, activation)" value={starB} />
        <DecayBar label="시냅스 밝기 = weight·max(a_min, act)" value={synB} />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/50">잠든 별 판정 (activation ≤ 2·a_min):</span>
          {dormantFlag ? (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">잠듦 (dormant)</span>
          ) : (
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">활성 (awake)</span>
          )}
        </div>
        <p className="text-[11px] text-white/35">
          Δt=30일 → activation≈0.5(반감기), 충분히 크면 별 밝기는 정확히 a_min=0.05에서 멈춥니다(0 아님).
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white/80">ListDormant — 잠든 별 탐색(보조 조회)</h3>
        <details className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
          <summary className="cursor-pointer text-white/60">고급: dev 토큰</summary>
          <textarea
            className={`${inputCls} mt-2 h-20 w-full font-mono text-xs`}
            placeholder="eyJ… (HS256 dev JWT)"
            value={devToken}
            onChange={(e) => setDevToken(e.target.value)}
          />
        </details>
        <button
          className="rounded-md bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
          onClick={() => void fetchDormant()}
          disabled={busy}
        >
          잠든 별 불러오기 (ListDormant)
        </button>
        {dormant && (
          <div className="space-y-1 text-sm">
            <p className="text-white/50">{dormant.length}개 (cutoff 이전 · last_recalled_at 오름차순)</p>
            <ul className="space-y-1">
              {dormant.map((s) => (
                <li key={s.memoryId} className="flex gap-2 rounded-md bg-white/5 px-3 py-1.5 text-xs">
                  <span className="font-mono text-white/60">{s.memoryId.slice(0, 10)}…</span>
                  <span className="text-white/50">{Mood[s.mood]}</span>
                  <span className="ml-auto text-white/35">{s.lastRecalledAt}</span>
                </li>
              ))}
              {dormant.length === 0 && (
                <li className="rounded-md bg-white/5 px-3 py-2 text-xs text-white/40">
                  잠든 별이 없습니다(전부 최근 회상). GetUniverse는 그래도 전체 그래프를 반환합니다(3.2).
                </li>
              )}
            </ul>
          </div>
        )}
        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">⚠ {error}</p>}
      </section>

      <p className="text-sm text-white/40">
        검증: 감쇠 곡선이 a_min에서 바닥 처리(1.2) · 시냅스 밝기=weight·max(a_min,act)(1.3) · ListDormant는
        cutoff 이전 별만(3.1), 삭제 아님 — GetUniverse는 전체 유지(3.2). 잠든 별 클릭→fly-to→회상은 /dormant에서.
      </p>
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
  { num: '05', title: 'embedding-worker', scope: 'BE', done: true, Panel: Spec05Panel },
  { num: '06', title: 'universe-canvas', scope: 'FE', done: true, Panel: Spec06Panel },
  { num: '07', title: 'force-sim', scope: 'FE', done: true, Panel: Spec07Panel },
  { num: '08', title: 'star-rendering', scope: 'FE', done: true, Panel: Spec08Panel },
  { num: '09', title: 'synapse-rendering', scope: 'FE', done: true, Panel: Spec09Panel },
  { num: '10', title: 'record-memory-ui', scope: 'FE', done: true, Panel: Spec10Panel },
  { num: '11', title: 'recall-reinforce', scope: 'FS', done: true, Panel: Spec11Panel },
  { num: '12', title: 'decay-dormant', scope: 'FS', done: true, Panel: Spec12Panel },
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
