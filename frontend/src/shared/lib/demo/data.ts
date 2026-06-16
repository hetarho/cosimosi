// 체험("demo") 모드 더미 우주 — 백엔드 호출 없이 프런트에서 만든 별/시냅스/원본 일기.
// 활성 페르소나(flag)의 일기 코퍼스(personas.ts)를 simulate가 별·시냅스로 빚고, 여기서 proto
// Star·Record·Synapse를 파생한다 — GetUniverse(별)·RecallMemory(원본 일기)·ListDormant(잠든
// 별)이 같은 id 공간을 공유해 일관된다. proto 모양 그대로 만들어(create) 기존 매퍼(mapStar/
// toSynapseEdge/recall 패널)를 재사용한다 — 체험 분기는 "데이터 출처"만 바꾸고 화면은 안 건드린다.
//
// 런타임 상태(seed된 별 + 체험 중 추가한 별)는 모듈 변수에 둔다. 라우트 이동·리렌더에는 유지되고,
// 새로고침하면 모듈이 리로드되며 base만 다시 생기고 추가분은 사라진다(요구사항). 페르소나를 바꾸면
// resetDemo로 base를 비워 다음 ensureSeeded가 새 페르소나로 재시드한다(widgets/demo-sim).
import { create } from '@bufbuild/protobuf'
import {
  Mood,
  RecordSchema,
  RecordSummarySchema,
  StarSchema,
  SynapseSchema,
  type Record as RecordMsg,
  type RecordSummary,
  type Star,
  type Synapse,
} from '@/shared/api'
import { mulberry32 } from '../prng'
import { virtualNowMs, resetDemoClock } from './clock'
import { getDemoPersona, type DemoPersona } from './flag'
import { CORPORA } from './personas'
import { crossResonances, simulate, type SimStar } from './simulate'
import { VALUES } from '@/shared/config'

const DAY_MS = 86_400_000

// 데모 별의 부호 정동(spec 25 — 요즘 상태 배경의 온도). 실서버는 AI가 조각별 valence를
// 추출·영속하지만, 체험은 네트워크 없이 mood에서 근사한다(shared/config MOOD_AFFECT의
// 정서가와 같은 값). deriveAmbient/ambientLights가 이 valence로 배경 색을 따뜻↔차갑게
// 보정해 "평온한 요즘=따뜻한 하늘 / 격동한 요즘=차가운 하늘"을 체험에서 보인다(1.11).
const MOOD_VALENCE: Partial<Record<Mood, number>> = {
  [Mood.JOY]: 0.8,
  [Mood.EXCITEMENT]: 0.65,
  [Mood.LOVE]: 0.75,
  [Mood.CALM]: 0.55,
  [Mood.GRATITUDE]: 0.6,
  [Mood.RELIEF]: 0.45,
  [Mood.ANGER]: -0.7,
  [Mood.FEAR]: -0.6,
  [Mood.STRESS]: -0.55,
  [Mood.SAD]: -0.6,
  [Mood.TIRED]: -0.45,
  [Mood.EMPTINESS]: -0.5,
  [Mood.NEUTRAL]: 0,
}
const valenceOf = (mood: Mood): number => MOOD_VALENCE[mood] ?? 0

// ── 페르소나 우주 — personas.ts의 일기 코퍼스를 simulate가 별·시냅스로 빚는다 ──
// 손으로 엔트리·엣지를 박지 않고(옛 DEMO_ENTRIES/DEMO_EDGES 폐기), 활성 페르소나(flag)의 코퍼스를
// fragment 단위 연결 규칙으로 시뮬레이션한다 — 한 일기가 여러 별로 나뉘고(다조각), 일내 결속·의미
// 링크·회상 다리가 주제 성단을 가로질러 얽힌다(simulate.ts).
function activeUniverse() {
  return simulate(CORPORA[getDemoPersona()])
}

function isoFrom(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString()
}

function dateFrom(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10) // YYYY-MM-DD
}

// 한 별(=한 조각)을 proto Star로. recordId/fragmentIndex(spec 28)는 simulate가 박아 둔다 —
// 단일 조각 일기는 id===recordId(자기 id가 곧 record), 다조각은 공유 recordId + 순서.
function toStar(now: number, s: SimStar): Star {
  const r = reshapeState.get(s.id)
  return create(StarSchema, {
    memoryId: s.id,
    mood: s.mood,
    intensity: s.intensity,
    valence: valenceOf(s.mood), // spec 25: 요즘 상태 배경 온도(체험 근사)
    lastRecalledAt: isoFrom(now, s.daysAgo), // 마지막 회상 경과일(회상 세션이 줄여 둔다)
    recordId: s.recordId,
    fragmentIndex: s.fragmentIndex,
    brightnessOffset: r?.brightnessOffset ?? 0,
    hueShift: r?.hueShift ?? 0,
    formSeedDelta: r?.formSeedDelta ?? 0,
    version: r?.version ?? 0,
  })
}

// ── 런타임 상태(모듈 수명 = 탭 세션, 새로고침 시 초기화) ──
let seededAt = 0
let baseStars: Star[] = []
let baseSynapses: Synapse[] = []
const records = new Map<string, RecordMsg>() // base + 체험 중 추가분, recall이 읽는다
const fragmentTextsById = new Map<string, string>() // memoryId → 그 조각 텍스트(spec 28; 단일 조각은 미등록 → "")
const addedStars: Star[] = [] // 체험 중 추가한 별(라우트 이동에도 유지, 새로고침 시 소멸)
const addedEdges: Synapse[] = [] // 체험 중 추가한 별의 연결(시냅스 생성 이론 시연, spec 19)

// 재공고화 재성형(spec 23): 별별 누적 재성형 상태 + 회상 시도 횟수(PE 게이트의 결정론 입력).
// toStar가 상태를 Star에 반영해 우주에서 별이 다시 빚어진다. 변천사 타임랩스(24)는
// demoEvolution이 결정론적으로 합성한다(체험 showcase — 별마다 ≥3 버전 보장).
interface DemoReshape {
  brightnessOffset: number
  hueShift: number
  formSeedDelta: number
  version: number
}
/** 변천사 한 스냅샷(서버 EvolutionSnapshot의 데모 대응 — 24 뷰어가 소비). brightness는
 *  뷰어가 바로 쓰는 표시 밝기(0..1), hueShift는 도, formSeedDelta는 형태 변주. */
export interface EvolutionSnap {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  trigger: string
  pe: number
  dir: number
  createdAt: string
}
const reshapeState = new Map<string, DemoReshape>()
const reshapeAttempts = new Map<string, number>() // memoryId → 회상 시도 누계(변형 여부 무관)

function ensureSeeded(): void {
  if (seededAt) return
  // 가상 now 기준 시드 — 진입 직후엔 offset=0이라 실제 now와 같고, 이후 시간 머신이
  // offset을 키우면 같은 데이터가 그만큼 "늙은" 것으로 파생된다(spec 19).
  seededAt = virtualNowMs()
  // 활성 페르소나(flag)의 일기 코퍼스를 fragment 단위 연결 규칙으로 시뮬레이션한다 — 한 일기가
  // 여러 별로 나뉘고(다조각), 일내 결속·의미 링크·회상 다리가 주제 성단을 가로질러 얽힌다(simulate).
  const uni = activeUniverse()
  baseStars = uni.stars.map((s) => toStar(seededAt, s))
  baseSynapses = uni.edges.map((ed) =>
    create(SynapseSchema, {
      aId: ed.a,
      bId: ed.b,
      weight: ed.weight,
      linkType: ed.linkType,
      lastActivatedAt: isoFrom(seededAt, ed.daysAgo),
    }),
  )
  // 원본 일기(record): 같은 일기의 모든 조각 별이 같은 본문을 공유한다(불변 1 record — 헌법1).
  // entry_date는 작성일(entryDaysAgo)이라 조각이 회상으로 흩어져도(daysAgo 달라도) 하나로 묶인다.
  for (const s of uni.stars) {
    records.set(
      s.id,
      create(RecordSchema, {
        memoryId: s.id,
        body: s.body,
        entryDate: dateFrom(seededAt, s.entryDaysAgo),
        mood: s.mood,
        intensity: s.intensity,
        createdAt: isoFrom(seededAt, s.entryDaysAgo),
      }),
    )
    // 다조각 일기의 조각이면 그 조각 텍스트 등록(별→조각, spec 28). 단일 조각은 null → 미등록(본문 폴백).
    if (s.fragmentText != null) fragmentTextsById.set(s.id, s.fragmentText)
  }
}

/** GetUniverse 대체: base + 체험 중 추가한 별. 라우트 재진입 시에도 추가분이 유지된다. */
export function demoStars(): Star[] {
  ensureSeeded()
  return [...baseStars, ...addedStars]
}

/** GetUniverse 시냅스: base + 체험 중 추가한 별의 연결(spec 19 — 시냅스 생성 시연). */
export function demoSynapses(): Synapse[] {
  ensureSeeded()
  return [...baseSynapses, ...addedEdges]
}

// ── 겹쳐보기(spec 37) 데모: 두 페르소나 우주 + 그 사이 공명 다리 ──
export interface DemoOverlaySide {
  persona: DemoPersona
  label: string
  stars: Star[]
  synapses: Synapse[]
}

/** 한 페르소나 코퍼스를 proto 우주(별·시냅스)로 빚는다 — 활성 페르소나 런타임 상태(addedStars)와
 *  무관한 *순수 코퍼스 스냅샷*이라, 활성 우주와 별개로 친구 우주를 동시에 띄울 수 있다(겹쳐보기). */
function buildPersonaUniverse(persona: DemoPersona, now: number): DemoOverlaySide {
  const uni = simulate(CORPORA[persona])
  return {
    persona,
    label: CORPORA[persona].label,
    stars: uni.stars.map((s) => toStar(now, s)),
    synapses: uni.edges.map((ed) =>
      create(SynapseSchema, {
        aId: ed.a,
        bId: ed.b,
        weight: ed.weight,
        linkType: ed.linkType,
        lastActivatedAt: isoFrom(now, ed.daysAgo),
      }),
    ),
  }
}

/** 겹쳐보기(spec 37) 데모 데이터: 활성 페르소나 우주 + 다른 페르소나 우주 + 두 우주 사이 공명 다리
 *  (crossResonances). 서버 없이 (b) 겹침 공간을 시연 — 두 페르소나 우주가 한 화면에 떠 빛의 다리로
 *  이어진다(36 공명의 쇼케이스). bridges.aId는 mine 우주, bId는 theirs 우주의 별 id. */
export function demoOverlayData(): {
  mine: DemoOverlaySide
  theirs: DemoOverlaySide
  bridges: { aId: string; bId: string }[]
} {
  const now = virtualNowMs()
  const minePersona = getDemoPersona()
  const order = Object.keys(CORPORA) as DemoPersona[]
  const other = order.find((p) => p !== minePersona)
  // 다른 페르소나가 없으면(코퍼스가 1개뿐인 축소 빌드) 같은 우주를 두 번 띄우지 않고 친구 쪽을 비운다 —
  // 같은 코퍼스끼리는 crossResonances가 자기 별을 잇는 무의미한 다리를 만들 수 있으므로 다리도 없다.
  const theirsPersona = other ?? minePersona
  return {
    mine: buildPersonaUniverse(minePersona, now),
    theirs: buildPersonaUniverse(theirsPersona, now),
    bridges: other ? crossResonances(CORPORA[minePersona], CORPORA[theirsPersona], 4) : [],
  }
}

/** RecallMemory 대체: 원본 일기. 없는 id면 undefined(패널이 에러 처리). */
export function demoRecall(memoryId: string): RecordMsg | undefined {
  ensureSeeded()
  return records.get(memoryId)
}

/** RecallMemory.fragment_text 대체(spec 28): 그 별의 조각 텍스트. 단일 조각/미등록이면 ""
 *  (패널이 원본 본문으로 폴백). */
export function demoFragmentText(memoryId: string): string {
  ensureSeeded()
  return fragmentTextsById.get(memoryId) ?? ''
}

/** ListRecords 대체(spec 28): 더미 우주의 별을 record_id로 묶어 원본 일기 목록을 만든다 —
 *  일기별 조각 별 개수 + 본문 발췌(80자) + 작성일 내림차순(서버 ListRecords와 같은 모양).
 *  body/entry_date는 그 record를 공유하는 조각의 records 항목에서 읽는다(모두 동일). */
export function demoListRecords(): RecordSummary[] {
  ensureSeeded()
  const byRecord = new Map<string, { entryDate: string; body: string; count: number }>()
  for (const s of [...baseStars, ...addedStars]) {
    const recordId = s.recordId || s.memoryId // 구 데이터/단일 조각은 자기 id가 곧 record
    const rec = records.get(s.memoryId)
    const existing = byRecord.get(recordId)
    if (existing) existing.count++
    else
      byRecord.set(recordId, { entryDate: rec?.entryDate ?? '', body: rec?.body ?? '', count: 1 })
  }
  return [...byRecord.entries()]
    .sort((a, b) =>
      a[1].entryDate < b[1].entryDate ? 1 : a[1].entryDate > b[1].entryDate ? -1 : 0,
    )
    .map(([recordId, v]) =>
      create(RecordSummarySchema, {
        recordId,
        entryDate: v.entryDate,
        bodyExcerpt: v.body.slice(0, 80),
        starCount: v.count,
      }),
    )
}

// 새 별이 만드는 데모 연결 수 상한 — 우주를 어지럽히지 않는 선에서 "연결이 생긴다"를 보인다.
const ADD_SAME_DAY_LINKS = VALUES.demoLinking.addSameDayLinks
const ADD_SAME_MOOD_LINKS = VALUES.demoLinking.addSameMoodLinks
// 흥분성 시간 창(~6h, 서버 tauExc와 동일) — 이 안에 회상된 별만 새 기억을 끌어당긴다(spec 22).
const HOT_WINDOW_MS = VALUES.excitability.tauHours * 60 * 60 * 1000

/** a<b 무방향 규약으로 데모 엣지를 추가한다(방금 생긴 연결 → lastActivatedAt = 가상 now). */
function pushAddedEdge(idA: string, idB: string, weight: number, linkType: string, nowIso: string) {
  const [aId, bId] = idA < idB ? [idA, idB] : [idB, idA]
  addedEdges.push(create(SynapseSchema, { aId, bId, weight, linkType, lastActivatedAt: nowIso }))
}

// ── 데모 분절 근사(spec 21) — 실서버 ai.Extractor의 **데모 근사** ──
// 실서버는 LLM이 사건 경계·조각 감정을 읽는다. 체험은 네트워크 없이: 빈 줄 문단을
// 사건 경계로(MockExtractor와 같은 구조 신호), 감정은 한국어 단서어 매칭 + (실패 시)
// 직전 조각과 다른 색 회전으로 근사한다 — "조각마다 색이 다르다"는 체험 보장(2.1).
const DEMO_MAX_FRAGMENTS = 3

const MOOD_KEYWORDS: [Mood, RegExp][] = [
  [Mood.ANGER, /화가|짜증|분노|열받|뒤집혔|억울/],
  [Mood.FEAR, /불안|걱정|두려|무서|떨렸|떨린/],
  [Mood.SAD, /슬프|눈물|우울|서글|허전|그리웠/],
  [Mood.RELIEF, /안도|다행|풀렸|후련/],
  [Mood.LOVE, /사랑|고마|다정|따뜻|포옹/],
  [Mood.JOY, /기쁘|행복|신나|즐겁|웃었|설레/],
  [Mood.CALM, /평온|고요|차분|편안|맑았|잔잔/],
]
// 회전 폴백 — 사분면이 갈리는 순서라 인접 조각의 색이 항상 다르다.
const MOOD_ROTATION: Mood[] = [Mood.CALM, Mood.ANGER, Mood.JOY, Mood.SAD, Mood.LOVE]

/** 빈 줄 문단 분리(사건 경계의 구조 근사) — 문단이 하나면 분할하지 않는다. */
function splitScenes(body: string): string[] {
  const scenes = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (scenes.length <= 1) return [body]
  if (scenes.length <= DEMO_MAX_FRAGMENTS) return scenes
  // 초과분은 마지막 조각에 합친다(텍스트 유실 없음 — ai.normalizeExtraction과 동일 규칙).
  return [
    ...scenes.slice(0, DEMO_MAX_FRAGMENTS - 1),
    scenes.slice(DEMO_MAX_FRAGMENTS - 1).join(' '),
  ]
}

/** 조각 감정 근사: 단서어 매칭 → 실패 시 직전 조각과 다른 색 회전. */
function detectSceneMood(text: string, index: number, prev: Mood | null): Mood {
  for (const [mood, re] of MOOD_KEYWORDS) if (re.test(text)) return mood
  const fallback = MOOD_ROTATION[index % MOOD_ROTATION.length]
  if (fallback !== prev) return fallback
  return MOOD_ROTATION[(index + 1) % MOOD_ROTATION.length]
}

/** RecordMemory 대체(spec 21): 일기를 조각 별 fan-out으로 더미 우주에 추가하고 조각
 *  id들을 돌려준다(API 호출 없음). 문단이 여럿이면 N개 별이 태어나 intra_entry 0.8로
 *  강하게 묶이고(같은 record body 공유), 단일 문단이면 기존처럼 별 1개다.
 *  연결 생성(spec 19)의 데모 근사도 유지한다 — 첫 조각이 같은 날 별과 temporal,
 *  같은 mood 최신 별과 semantic으로 이어진다(임베딩 없는 근사임은 패널이 밝힌다). */
export function demoAddRecord(input: {
  body: string
  mood: Mood
  intensity: number
  entryDate: string
}): string[] {
  ensureSeeded()
  const now = virtualNowMs()
  const nowIso = new Date(now).toISOString()
  const scenes = splitScenes(input.body)
  const baseId = `demo-new-${crypto.randomUUID()}`

  const ids: string[] = []
  let prevMood: Mood | null = null
  scenes.forEach((scene, i) => {
    const id = scenes.length === 1 ? baseId : `${baseId}-f${i}`
    // 수동 힌트(첫 조각)가 있으면 그대로, 아니면 조각마다 감정을 근사 감지한다.
    const mood =
      scenes.length === 1 && input.mood !== Mood.MOOD_UNSPECIFIED
        ? input.mood
        : detectSceneMood(scene, i, prevMood)
    prevMood = mood
    const intensity = input.intensity > 0 ? input.intensity : 0.65
    // 원본은 공유(불변 1 record — 헌법1): 어느 조각 별을 열어도 같은 일기가 보인다.
    records.set(
      id,
      create(RecordSchema, {
        memoryId: id,
        body: input.body,
        entryDate: input.entryDate,
        mood,
        intensity,
        createdAt: nowIso,
      }),
    )
    addedStars.push(
      create(StarSchema, {
        memoryId: id,
        mood,
        intensity,
        valence: valenceOf(mood), // spec 25: 새 조각도 요즘 상태 배경을 그쪽 색으로 끌어당긴다
        lastRecalledAt: nowIso, // 방금 만든 별 → 가장 밝게
        recordId: baseId, // spec 28: 같은 일기의 조각은 baseId로 묶인다(단일 조각이면 id===baseId)
        fragmentIndex: i,
      }),
    )
    // 다조각이면 그 장면이 조각 텍스트(별 → 조각); 단일 문단이면 본문==조각이라 미등록("" 폴백).
    if (scenes.length > 1) fragmentTextsById.set(id, scene)
    ids.push(id)
  })

  // 일내 결속(within-event binding): 모든 조각 쌍을 강한 고정 가중치로.
  for (let i = 0; i < ids.length; i++) {
    for (let k = i + 1; k < ids.length; k++) {
      pushAddedEdge(ids[i], ids[k], VALUES.connection.intraEntryWeight, 'intra_entry', nowIso)
    }
  }

  // 같은 날 시간창: entryDate가 같은 기존 일기와 잇는다(최신순 상한 ADD_SAME_DAY_LINKS).
  const first = ids[0]
  const idSet = new Set(ids)
  const others = [...records.values()].filter((r) => !idSet.has(r.memoryId))
  const sameDay = others
    .filter((r) => r.entryDate === input.entryDate)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, ADD_SAME_DAY_LINKS)
  for (const r of sameDay) pushAddedEdge(first, r.memoryId, VALUES.demoLinking.addTemporalWeight, 'temporal', nowIso)

  // 의미 근사: 첫 조각과 같은 mood의 최신 일기와 잇는다(같은 날로 이미 이어진 별은 제외).
  const firstMood = records.get(first)?.mood
  const linkedIds = new Set(sameDay.map((r) => r.memoryId))
  const sameMood = others
    .filter((r) => r.mood === firstMood && !linkedIds.has(r.memoryId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, ADD_SAME_MOOD_LINKS)
  for (const r of sameMood) pushAddedEdge(first, r.memoryId, VALUES.demoLinking.addSemanticWeight, 'semantic', nowIso)
  for (const r of sameMood) linkedIds.add(r.memoryId)

  // 흥분성 편향 할당(spec 22) 데모 근사: 방금(~6h 내) 회상해 "뜨거운" 별이 있으면 새 조각을
  // 그 별과도 잇는다 — 라이브 force-sim이 새 별을 그 hot 성단 곁으로 끌어간다(회상→새 기억).
  // ~6h를 넘겨 식으면 후보에서 빠져 끌림이 사라진다(시간 창 시연, 1.11). 서버 biasedLinks의
  // 흥분성 편향(semantic + W_EXC·e)을 네트워크 없이 흉내 낸 것이다.
  const hot = [...baseStars, ...addedStars]
    .filter((s) => !idSet.has(s.memoryId) && !linkedIds.has(s.memoryId))
    .map((s) => ({ id: s.memoryId, recalled: Date.parse(s.lastRecalledAt) }))
    .filter((s) => Number.isFinite(s.recalled) && now - s.recalled <= HOT_WINDOW_MS)
    .sort((a, b) => b.recalled - a.recalled)[0]
  if (hot) pushAddedEdge(first, hot.id, VALUES.demoLinking.addExcitabilityWeight, 'semantic', nowIso)

  return ids
}

// 시뮬 패널 "별 띄우기"용 — 감정별로 미리 써 둔 짧은 일기 10개. 체험에서 내용 자체는
// 중요하지 않으므로(별 탄생·연결 생성을 보여주는 용도) 무작위로 하나를 골라 띄운다.
const QUICK_ENTRIES: { mood: Mood; intensity: number; body: string }[] = [
  {
    mood: Mood.JOY,
    intensity: 0.85,
    body: '드디어 합격 메일이 왔다. 몇 번을 다시 읽었는지 모른다. 오늘 밤은 잠이 안 올 것 같다.',
  },
  {
    mood: Mood.JOY,
    intensity: 0.7,
    body: '길에서 동전 노래방을 발견하고 두 곡 불렀다. 목은 쉬었지만 기분은 최고.',
  },
  {
    mood: Mood.LOVE,
    intensity: 0.9,
    body: '오늘 손을 잡고 걸었다. 별말 없이 걸었는데도 그 길이 끝나지 않길 바랐다.',
  },
  {
    mood: Mood.LOVE,
    intensity: 0.75,
    body: '동생이 말없이 내 책상에 귤을 까놓고 갔다. 다정함은 이렇게 조용히 온다.',
  },
  {
    mood: Mood.CALM,
    intensity: 0.5,
    body: '창문을 열어두고 빗소리를 들으며 차를 마셨다. 아무 일도 없는 저녁이 좋다.',
  },
  {
    mood: Mood.CALM,
    intensity: 0.45,
    body: '아침 일찍 동네를 한 바퀴 걸었다. 공기가 차고 깨끗해서 머리가 맑아졌다.',
  },
  {
    mood: Mood.SAD,
    intensity: 0.6,
    body: '오래 쓰던 머그컵이 깨졌다. 그냥 컵일 뿐인데, 마음 한구석이 같이 금 갔다.',
  },
  {
    mood: Mood.ANGER,
    intensity: 0.65,
    body: '줄을 서 있는데 누가 아무렇지 않게 새치기를 했다. 한마디 못 한 내가 더 분하다.',
  },
  {
    mood: Mood.FEAR,
    intensity: 0.55,
    body: '내일 결과 발표다. 휴대폰을 쥐었다 놓았다 하며 하루를 다 써버렸다.',
  },
  {
    mood: Mood.NEUTRAL,
    intensity: 0.4,
    body: '장을 보고, 빨래를 개고, 일찍 누웠다. 적당히 평범해서 나쁘지 않은 하루.',
  },
]

/** 시뮬 패널 "별 띄우기": 고른 감정·날짜로 별을 만든다(spec 19 — 데모의 기록 컨트롤러).
 *  본문은 그 감정으로 미리 써 둔 일기 중 무작위 — 체험에서 내용은 시연용일 뿐이다.
 *  새 별 id를 돌려준다(단일 문단 일기 → 항상 별 1개). */
export function demoAddStar(mood: Mood, entryDate: string): string {
  const pool = QUICK_ENTRIES.filter((q) => q.mood === mood)
  const pick = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : QUICK_ENTRIES[0]
  return demoAddRecord({ body: pick.body, mood, intensity: pick.intensity, entryDate })[0]
}

// 시뮬 패널 "다감정 하루 띄우기"(spec 21)용 — 장면(문단)마다 감정이 갈리는 미리 쓴
// 다감정 일기들. 빈 줄 문단이 사건 경계로 읽혀 demoAddRecord가 N개 별로 fan-out한다.
const MULTI_SCENE_ENTRIES: string[] = [
  [
    '늦잠을 자고 일어나 창을 여니 볕이 좋아서 괜히 웃었다. 오랜만에 느긋한 아침.',
    '오후에 메일 하나로 일정이 전부 꼬였다. 짜증이 솟았지만 어디에 화를 내야 할지도 몰랐다.',
    '저녁엔 좋아하는 노래를 틀어놓고 방을 정리했다. 마음이 조금씩 차분해졌다.',
  ].join('\n\n'),
  [
    '발표 직전까지 손이 떨렸다. 실수하면 어쩌나 하는 걱정이 멈추지 않았다.',
    '끝나고 나니 다행이라는 말밖에 안 나왔다. 어깨가 한꺼번에 풀렸다.',
    '집에 오는 길, 고생했다며 친구가 사준 따뜻한 국밥. 고마워서 코끝이 찡했다.',
  ].join('\n\n'),
]

/** 시뮬 패널 "다감정 하루 띄우기"(spec 21): 여러 감정이 담긴 미리 쓴 일기 한 편을
 *  조각 별 fan-out으로 띄운다 — 색이 다른 N개 별이 강한 일내 선으로 묶여 등장한다.
 *  태어난 조각 id들을 돌려준다. */
export function demoAddMultiSceneStar(entryDate: string): string[] {
  const body = MULTI_SCENE_ENTRIES[Math.floor(Math.random() * MULTI_SCENE_ENTRIES.length)]
  return demoAddRecord({ body, mood: Mood.MOOD_UNSPECIFIED, intensity: 0, entryDate })
}

/** 별 띄우기 날짜 입력의 기본값 — 오늘(가상 시계 기준), YYYY-MM-DD. */
export function demoToday(): string {
  return dateFrom(virtualNowMs(), 0)
}

/** RecallMemory의 재점화(서버 `last_recalled_at=now`)를 데모에서 재현한다(spec 19):
 *  그 별의 lastRecalledAt을 가상 now로 전진. **불변 교체**로 새 Star 객체를 만들어야
 *  쿼리 캐시의 protobuf structural sharing이 변경을 감지한다(제자리 변이는 이전
 *  응답까지 같이 바뀌어 refetch가 no-op이 된다). 원본(records)은 불변(헌법1).
 *  누적 재성형 상태(spec 23)는 보존해 교체로 사라지지 않게 한다. */
function renewStar(s: Star, lastRecalledAt: string): Star {
  const r = reshapeState.get(s.memoryId)
  return create(StarSchema, {
    memoryId: s.memoryId,
    mood: s.mood,
    intensity: s.intensity,
    valence: s.valence, // 회상 재점화에도 부호 정동 보존(spec 25 배경 온도)
    relevance: s.relevance, // 관련성(spec 26)도 보존 — 불변 교체가 서버 파생값을 0으로 지우지 않게
    recordId: s.recordId, // 일기 단위 그룹 키(spec 28)도 보존
    fragmentIndex: s.fragmentIndex,
    lastRecalledAt,
    brightnessOffset: r?.brightnessOffset ?? s.brightnessOffset,
    hueShift: r?.hueShift ?? s.hueShift,
    formSeedDelta: r?.formSeedDelta ?? s.formSeedDelta,
    version: r?.version ?? s.version,
  })
}

/** baseStars/addedStars에서 그 별을 불변 교체한다(structural sharing이 변경을 감지하도록). */
function replaceStar(memoryId: string, next: (s: Star) => Star): void {
  const bi = baseStars.findIndex((s) => s.memoryId === memoryId)
  if (bi >= 0) {
    baseStars[bi] = next(baseStars[bi])
    return
  }
  const ai = addedStars.findIndex((s) => s.memoryId === memoryId)
  if (ai >= 0) addedStars[ai] = next(addedStars[ai])
}

export function demoMarkRecalled(memoryId: string): void {
  ensureSeeded()
  const nowIso = new Date(virtualNowMs()).toISOString()
  replaceStar(memoryId, (s) => renewStar(s, nowIso))
}

// 재공고화 재성형 파라미터(spec 23 데모 — 서버 service.go·랜딩 카드와 같은 결, VALUES.reshape 출처).
const DEMO_PE_THRESHOLD = VALUES.reshape.peThreshold
const HUE_MAX_DEG = VALUES.reshape.hueMaxDeg
const FORM_DELTA_MAX = VALUES.reshape.formDeltaMax
const clampDemo = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** 회상 거듭될수록(version↑) 별이 굳어 변화폭이 작아진다(강도 의존 — strength↑ ⇒ magnitude↓). */
function demoStrength(version: number): number {
  return clampDemo(VALUES.reshape.baseStep * Math.log2(1 + version), 0, 0.85)
}

/** id → PRNG 시드(FNV-1a 32-bit). seedFromId(entities)의 데모 로컬 판 — shared는 entities를
 *  import할 수 없으므로(FSD 하향 의존) 여기 둔다. */
function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** RecallMemory의 PE 게이트 재성형(spec 23)을 데모에서 재현한다: 회상이 담은 새 맥락(PE)이
 *  충분할 때만(>=0.15) 대상 별을 경계 안에서 양방향으로 다시 빚고(밝기·색조·형태) 별을 불변
 *  교체해 우주에 반영한다. novelty 없는 회상(PE<0.15)은 무변. attempt마다 결정론적 PE를 뽑아
 *  "매 회상 ≠ 변형"을 보인다(서버는 MVP에서 PE 0이라 무변 — 체험은 novelty를 시뮬레이션). */
export function demoReshape(memoryId: string): void {
  ensureSeeded()
  const attempt = (reshapeAttempts.get(memoryId) ?? 0) + 1
  reshapeAttempts.set(memoryId, attempt)
  // 결정론적 PE: id+attempt 해시 → [0,1).
  const pe = mulberry32(hashId(memoryId) + attempt * 2654435761)()
  if (pe < DEMO_PE_THRESHOLD) return // novelty 없음 → 단순 재점화만(변형 없음)

  const prev = reshapeState.get(memoryId) ?? {
    brightnessOffset: 0,
    hueShift: 0,
    formSeedDelta: 0,
    version: 0,
  }
  const magnitude = (0.1 + 0.12 * pe) * (1 - demoStrength(prev.version)) // strength↑ ⇒ 작아짐
  const dir = mulberry32(hashId(memoryId) * 2654435761 + attempt)() < 0.5 ? -1 : 1
  // 게인은 서버 service.go(hueGainDeg=60·formGain=0.5)와 일치시켜 체험 우주가 실서버와
  // 같은 폭으로 다시 빚어지게 한다(데모는 실 렌더러를 그대로 탄다 — 같은 aHueShift 경로).
  const next: DemoReshape = {
    brightnessOffset: clampDemo(
      prev.brightnessOffset + dir * clampDemo(magnitude, VALUES.reshape.minBrightStep, VALUES.reshape.maxBrightStep),
      -1,
      1,
    ),
    hueShift: clampDemo(prev.hueShift + dir * magnitude * VALUES.reshape.hueGainDeg, -HUE_MAX_DEG, HUE_MAX_DEG),
    formSeedDelta: clampDemo(
      prev.formSeedDelta + dir * magnitude * VALUES.reshape.formGain,
      -FORM_DELTA_MAX,
      FORM_DELTA_MAX,
    ),
    version: prev.version + 1,
  }
  reshapeState.set(memoryId, next)
  // 별을 불변 교체해 우주가 변형된 별을 그린다(lastRecalledAt은 demoMarkRecalled가 따로 전진).
  const nowIso = new Date(virtualNowMs()).toISOString()
  replaceStar(memoryId, (s) => renewStar(s, nowIso))
}

// 야간 공고화(spec 27) 체험 근사 — 서버 4패스의 데모 대응(네트워크 없이). 별·선은 절대
// 지우지 않는다(헌법2): 개수는 그대로 두고 ③ 요지(오래된 별의 형태를 한 단계 단순화)와
// ④ 가지치기(약하고 안 쓰인 선의 weight를 바닥으로 — 어둑하게만)만 데이터에 반영한다.
// ①②(재안정화·재분배)는 좌표 변환이라 라이브 force-sim이 refetch에서 다시 안정화하며 보인다.
const DEMO_GIST_AGE_DAYS = VALUES.consolidation.gistAgeDays // 마지막 회상 후 이보다 오래된 별이 요지 대상(서버와 동일)
const DEMO_GIST_SIMPLIFY = VALUES.demoConsolidation.gistFormSimplify // 요지 1회의 form_seed_delta 단조 증가폭(데모 전용)
const DEMO_WEAK_THRESHOLD = VALUES.demoConsolidation.weakEdgeThreshold // 데모 우주는 선이 촘촘·강해 상대적 약함 기준(서버 0.2의 데모 근사)
const DEMO_IDLE_DAYS = VALUES.consolidation.weakEdgeIdleDays // 이보다 오래 안 쓰인 선이 가지치기 대상(서버와 동일)
const DEMO_PRUNE_FLOOR = VALUES.demoConsolidation.weakEdgeFloor // 가지치기 후 선이 가닿는 최소 weight(0 아님 — 데모 전용)

/** RecordMemory처럼 데모 우주를 제자리에서 변환한다 — "밤 보내기"(spec 27): 오래된 별의
 *  형태를 한 단계 요지화하고(③), 약하고 안 쓰인 선은 빛만 바닥으로 낮춘다(④). 별·선 개수는
 *  그대로(삭제 0 — 헌법2). 불변 교체로 새 객체를 만들어 쿼리 캐시가 변경을 감지하게 한다. */
export function demoConsolidate(): void {
  ensureSeeded()
  const now = virtualNowMs()
  // ③ 요지: 오래되고 저회상인 별의 form_seed_delta 단조 증가 + version++(형태가 한 단계 가라앉는다).
  for (const s of [...baseStars, ...addedStars]) {
    const recalledMs = Date.parse(s.lastRecalledAt)
    if (!Number.isFinite(recalledMs)) continue
    if ((now - recalledMs) / DAY_MS <= DEMO_GIST_AGE_DAYS) continue
    const prev = reshapeState.get(s.memoryId) ?? {
      brightnessOffset: 0,
      hueShift: 0,
      formSeedDelta: 0,
      version: 0,
    }
    if (prev.formSeedDelta >= FORM_DELTA_MAX) continue // 이미 다 단순화 — 후퇴 없음(단조)
    reshapeState.set(s.memoryId, {
      ...prev,
      formSeedDelta: clampDemo(prev.formSeedDelta + DEMO_GIST_SIMPLIFY, 0, FORM_DELTA_MAX),
      version: prev.version + 1,
    })
    replaceStar(s.memoryId, (st) => renewStar(st, st.lastRecalledAt)) // lastRecalledAt 보존(요지는 회상 아님)
  }
  // ④ 가지치기: 약하고(weight<임계) 안 쓰인(idle>14일) 선의 weight를 바닥으로 — 어둑하게만, 삭제 0.
  const prune = (list: Synapse[]) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      const idleDays = (now - Date.parse(e.lastActivatedAt)) / DAY_MS
      if (
        e.weight < DEMO_WEAK_THRESHOLD &&
        Number.isFinite(idleDays) &&
        idleDays > DEMO_IDLE_DAYS
      ) {
        list[i] = create(SynapseSchema, {
          aId: e.aId,
          bId: e.bId,
          weight: Math.min(e.weight, DEMO_PRUNE_FLOOR),
          linkType: e.linkType,
          lastActivatedAt: e.lastActivatedAt,
          coActivationCount: e.coActivationCount,
        })
      }
    }
  }
  prune(baseSynapses)
  prune(addedEdges)
}

// 변천사 타임랩스(24) 체험용 합성. 한 별을 여러 번 novelty 회상한 결과를 결정론적으로 빚어,
// 어떤 별을 열어도 ≥3 버전(version 0 최초 + 재성형들)이 또렷이 다른 형태/색조/밝기로 보이게
// 한다. trigger를 회상/새 이웃/야간 요지로 섞고, ReconsolidationCard식 제약 드리프트를 쓴다.
const DEMO_EVO_TRIGGERS = ['recall', 'recall', 'new_neighbor', 'nightly_gist']

/** GetEvolutionHistory 대체(spec 24 데모): 그 별의 변천사(version 오름차순, ≥3 버전).
 *  brightness는 뷰어 표시 밝기(0.4..1), hueShift는 ±28° 이내, formSeedDelta는 ±0.6 이내. */
export function demoEvolution(memoryId: string): EvolutionSnap[] {
  const seed = hashId(memoryId)
  const dayMs = DAY_MS
  const now = virtualNowMs()
  // v0 — 최초 모습(변형 없음).
  const snaps: EvolutionSnap[] = [
    {
      version: 0,
      brightness: 0.7,
      hueShift: 0,
      formSeedDelta: 0,
      trigger: 'recall',
      pe: 0,
      dir: 0,
      createdAt: new Date(now - DEMO_EVO_TRIGGERS.length * dayMs).toISOString(),
    },
  ]
  for (let i = 1; i < DEMO_EVO_TRIGGERS.length; i++) {
    const prev = snaps[i - 1]
    const rand = mulberry32(seed + i * 2654435761)
    const pe = 0.3 + rand() * 0.6 // novelty 충분(게이트 통과) — 표시 보조값
    const step = 0.08 + rand() * 0.1
    const dir = rand() < 0.5 ? -1 : 1
    snaps.push({
      version: i,
      brightness: clampDemo(prev.brightness + dir * step, 0.4, 1),
      hueShift: clampDemo(prev.hueShift + dir * step * VALUES.reshape.hueGainDeg, -HUE_MAX_DEG, HUE_MAX_DEG),
      formSeedDelta: clampDemo(
        prev.formSeedDelta + dir * step * 1.4,
        -FORM_DELTA_MAX,
        FORM_DELTA_MAX,
      ),
      trigger: DEMO_EVO_TRIGGERS[i],
      pe,
      dir,
      createdAt: new Date(now - (DEMO_EVO_TRIGGERS.length - i) * dayMs).toISOString(),
    })
  }
  return snaps
}

/** 체험 종료 시 추가분·가상 시계를 비워 다음 진입을 깨끗하게 한다(base는 다음 ensureSeeded에서 재생성). */
export function resetDemo(): void {
  seededAt = 0
  baseStars = []
  baseSynapses = []
  addedStars.length = 0
  addedEdges.length = 0
  records.clear()
  fragmentTextsById.clear()
  reshapeState.clear()
  reshapeAttempts.clear()
  resetDemoClock()
}
