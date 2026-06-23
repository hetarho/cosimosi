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
import { abstractionStageForRadius, connectednessById, emotionSimilarity, starRadius } from '../memory-physics'
import { virtualNowMs, resetDemoClock } from './clock'
import { getDemoPersona, isDemoPersona, type DemoPersona } from './flag'
import { activeDiaryPreset, clearActiveDiaryPreset, pickDiaryPreset, presetBody } from './diary-presets'
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
// 손으로 엔트리·엣지를 박지 않고, 활성 페르소나(flag)의 코퍼스를
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

// 별별 추상화 단계(change 20·spec 53) — 야간 요지가 반지름으로 트리거해 단조 승급(GREATEST)하는
// 영속 상태. 서버는 memories.abstraction_stage에 영속하지만 데모는 모듈 맵에 들고, toStar/renewStar가
// Star에 실어 렌더(aShape.w)가 형태 단순화로 소비한다. 데모 전엔 이 값이 안 실려 영영 0이던 버그를
// 해소한다(job 43). 별 반지름에서 파생하므로(거리=강함) 멀어진 별일수록 단계가 높다.
const abstractionStageById = new Map<string, number>()

/** 별의 추상화 단계를 반지름 기준으로 단조 승급(GREATEST)하고 현재 값을 돌려준다 — 서버 nightly
 *  abstraction_stage = GREATEST(현재, stageForRadius(radius))의 데모 미러. 줄지 않는다(append-only). */
function raiseAbstractionStage(id: string, radius: number): number {
  const next = Math.max(abstractionStageById.get(id) ?? 0, abstractionStageForRadius(radius))
  abstractionStageById.set(id, next)
  return next
}

// 한 별(=한 조각)을 proto Star로. recordId/fragmentIndex(spec 28)는 simulate가 박아 둔다 —
// 단일 조각 일기는 id===recordId(자기 id가 곧 record), 다조각은 공유 recordId + 순서.
// connectedness는 그 별의 정규화 연결성(거리=강함 반지름 입력) — 호출자가 시냅스 그래프에서 파생해 준다.
function toStar(now: number, s: SimStar, connectedness: number): Star {
  const r = reshapeState.get(s.id)
  const recallCount = 1 + Math.round(s.intensity * 3)
  const lastMs = now - s.daysAgo * DAY_MS
  // 추상화 단계: 자아 거리 반지름에서 파생(서버 stageForRadius 미러). 멀어진 별일수록 높다.
  const stage = raiseAbstractionStage(s.id, starRadius(recallCount, s.intensity, lastMs, now, connectedness))
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
    abstractionStage: stage, // change 20: 반지름 트리거 요지 단계(데모에 영영 0이던 버그 해소)
    // spec 07: 데모 별에 회상 횟수 부여 — 정서적인 별일수록 더 자주 떠올린 것으로(같은 Bjork R 경로 미러).
    // 회상 세션(renewStar)이 +1 한다. 실서버와 같은 R-순위·배경 짜임 경로를 데모도 그대로 탄다.
    recallCount: BigInt(recallCount),
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
// 가지친(severed) 선의 키 집합 — 서버 memory_links.severed의 데모 대응(change 20). 가지치기가 약하고
// 안 쓰인 선을 바닥으로 낮추며 표시하고, 야간 재가중은 이 선을 건드리지 않으며(되살아나 0.79로 기어
// 오르지 않게), re-KNN이 닮은 기억 재발견으로 되살린다(severed 해제). 연결성·보호·healthy degree 판정도
// severed를 제외한다. 삭제는 아니다(선은 남고 어둑할 뿐 — 헌법2).
const severedById = new Set<string>()

/** a<b 무방향 쌍 키 — base·added 엣지 식별 단일 규약. */
const pairKey = (aId: string, bId: string): string => (aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`)

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
  // 시냅스 먼저 — 별 반지름(거리=강함)·추상화 단계가 연결성을 입력으로 쓰므로 toStar 전에 그래프를 짠다.
  baseSynapses = uni.edges.map((ed) =>
    create(SynapseSchema, {
      aId: ed.a,
      bId: ed.b,
      weight: ed.weight,
      linkType: ed.linkType,
      lastActivatedAt: isoFrom(seededAt, ed.daysAgo),
    }),
  )
  const conn = connectednessById(baseSynapses)
  baseStars = uni.stars.map((s) => toStar(seededAt, s, conn.get(s.id) ?? 0))
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
  const synapses = uni.edges.map((ed) =>
    create(SynapseSchema, {
      aId: ed.a,
      bId: ed.b,
      weight: ed.weight,
      linkType: ed.linkType,
      lastActivatedAt: isoFrom(now, ed.daysAgo),
    }),
  )
  const conn = connectednessById(synapses)
  return {
    persona,
    label: CORPORA[persona].label,
    stars: uni.stars.map((s) => toStar(now, s, conn.get(s.id) ?? 0)),
    synapses,
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
  const order = Object.keys(CORPORA).filter(isDemoPersona)
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

/** RecallMemory.fragment_text 대체: 그 별의 조각 텍스트. 단일 조각/미등록이면 ""
 *  (패널이 원본 본문으로 폴백). */
export function demoFragmentText(memoryId: string): string {
  ensureSeeded()
  return fragmentTextsById.get(memoryId) ?? ''
}

/** GetRecord 대체: record_id로 원본 전문을 읽는다 — 그 record를 공유하는
 *  아무 별의 records 항목을 찾아 record_id를 채워 돌려준다(단일 조각은 memory_id == record_id).
 *  없으면 undefined(독립 일기 페이지가 NotFound 처리). 부작용 없음(데모도 별 layer 미변경). */
export function demoGetRecord(recordId: string): RecordMsg | undefined {
  ensureSeeded()
  for (const s of [...baseStars, ...addedStars]) {
    if ((s.recordId || s.memoryId) !== recordId) continue
    const rec = records.get(s.memoryId)
    if (rec) return create(RecordSchema, { ...rec, recordId })
  }
  return undefined
}

/** ListRecords 대체: 더미 우주의 별을 record_id로 묶어 원본 일기 목록을 만든다 —
 *  일기별 조각 별 개수 + 본문 발췌(80자) + 작성일 내림차순(서버 ListRecords와 같은 모양).
 *  body/entry_date는 그 record를 공유하는 조각의 records 항목에서 읽는다(모두 동일). */
export function demoListRecords(): RecordSummary[] {
  ensureSeeded()
  const byRecord = new Map<
    string,
    { entryDate: string; body: string; count: number; moods: Set<Mood> }
  >()
  for (const s of [...baseStars, ...addedStars]) {
    const recordId = s.recordId || s.memoryId // 단일 조각은 자기 id가 곧 record
    const rec = records.get(s.memoryId)
    const existing = byRecord.get(recordId)
    if (existing) {
      existing.count++
      if (s.mood !== Mood.MOOD_UNSPECIFIED) existing.moods.add(s.mood)
    } else
      byRecord.set(recordId, {
        entryDate: rec?.entryDate ?? '',
        body: rec?.body ?? '',
        count: 1,
        moods: s.mood !== Mood.MOOD_UNSPECIFIED ? new Set([s.mood]) : new Set(),
      })
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
        moods: [...v.moods], // 일기 감정 facet(데모 — 서버 ListRecords와 동형)
      }),
    )
}

/** a<b 무방향 규약으로 데모 엣지를 upsert한다 — 같은 쌍이 이미 있으면(base·added) weight를 GREATEST로
 *  올리고 linkType·lastActivatedAt을 갱신하며 severed를 해제한다(서버 BatchUpsertLinks/ReknnUpsertLinks의
 *  conflict upsert 대응 — 중복 행 금지·재발견 부활). 없으면 새 added 엣지를 만든다(방금 생긴 연결 → now). */
function upsertEdge(idA: string, idB: string, weight: number, linkType: string, nowIso: string) {
  const [aId, bId] = idA < idB ? [idA, idB] : [idB, idA]
  const key = pairKey(aId, bId)
  const revive = (list: Synapse[]): boolean => {
    const i = list.findIndex((e) => e.aId === aId && e.bId === bId)
    if (i < 0) return false
    list[i] = create(SynapseSchema, {
      aId,
      bId,
      weight: Math.max(list[i].weight, weight),
      linkType,
      lastActivatedAt: nowIso,
      coActivationCount: list[i].coActivationCount,
    })
    severedById.delete(key)
    return true
  }
  if (revive(baseSynapses) || revive(addedEdges)) return
  addedEdges.push(create(SynapseSchema, { aId, bId, weight, linkType, lastActivatedAt: nowIso }))
}

// ── 새 일기 연결 생성 — production 식(데모 전용 가중치 제거, change 25) ──
// 실서버는 새 별을 임베딩해 KNN 이웃(cos≥0.75)을 찾고 weight = α·cos + 시간보너스 + emoα·감정유사도
// (캡 0.79)로 잇는다(connection.*, job 37). 데모엔 임베딩이 없어 의미 이웃을 같은 감정(mood)으로
// 게이트하는 정직한 근사를 쓰되, weight 식·정전 값은 production 그대로다(데모 전용 add*/hot 가중치는
// 폐기). 서버 식의 충실한 포트(KNN·흥분성 편향 할당·골든 대조)는 job 43이 마저 맞춘다.
const TEMPORAL_DAYS = VALUES.connection.temporalWindowDays
const TEMPORAL_MAX = VALUES.connection.temporalBonusMax
// 감정 유사도(emotionSimilarity)는 shared/lib/memory-physics에서 import(데모·실렌더·시드 그래프 공유).

/** 같은 주(週) temporal 보너스(서버 temporalBonus) — 며칠 차이가 창보다 작을수록 크다. 날짜를 못
 *  읽으면(re-KNN의 빈 entryDate 등) 0(시간 보너스 없음 — 순수 의미 재연결). */
function temporalBonusDays(diffDays: number): number {
  if (!Number.isFinite(diffDays)) return 0
  const d = Math.abs(diffDays)
  return d >= TEMPORAL_DAYS ? 0 : TEMPORAL_MAX * (1 - d / TEMPORAL_DAYS)
}

/** 새 일기의 대표(첫) 조각을 기존 일기들과 production 식으로 잇는다 — 같은 감정(임베딩 없는 데모의
 *  의미 근사) 또는 같은 날 후보만 게이트하고 weight = clamp(α·sem + 시간보너스 + emoα·감정유사도, 0,
 *  캡)으로 점수를 매긴다. 한 기존 일기엔 가장 센 조각 하나로만(record 단위 중복 방지) 잇고, 상위
 *  biasedK(서버 흥분성 편향 할당의 최종 링크 수)만 남긴다. 서버 KNN·흥분성 편향의 정직한 데모 근사다
 *  (cos≥0.75 게이트의 충실한 포트·골든 대조는 job 43). */
function linkNewDiary(
  firstId: string,
  mood: Mood,
  valence: number,
  intensity: number,
  entryDate: string,
  idSet: Set<string>,
  nowIso: string,
): void {
  const best = new Map<string, { id: string; weight: number; linkType: string }>() // recordId → 최고 점수 후보
  for (const s of [...baseStars, ...addedStars]) {
    if (idSet.has(s.memoryId)) continue
    const rec = records.get(s.memoryId)
    const sameMood = s.mood === mood
    const sameDay = rec?.entryDate === entryDate
    if (!sameMood && !sameDay) continue
    const emoSim = emotionSimilarity(valence, intensity, s.valence, s.intensity)
    const diffDays = rec ? (Date.parse(entryDate) - Date.parse(rec.entryDate)) / DAY_MS : 0
    const sem = sameMood ? 0.6 : 0 // 같은 감정 = 의미 근사(서버 cos 자리). 다른 감정은 시간만으로.
    const weight = clampDemo(
      VALUES.connection.weightAlpha * sem +
        temporalBonusDays(diffDays) +
        VALUES.connection.emoAlpha * emoSim,
      0,
      VALUES.connection.semanticWeightCap,
    )
    if (weight <= 0) continue
    const recordId = s.recordId || s.memoryId
    const cur = best.get(recordId)
    if (!cur || weight > cur.weight)
      best.set(recordId, { id: s.memoryId, weight, linkType: sameMood ? 'semantic' : 'temporal' })
  }
  const top = [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, VALUES.excitability.biasedK)
  for (const c of top) upsertEdge(firstId, c.id, c.weight, c.linkType, nowIso)
}

/** 데모 우주에 새 일기를 조각 별 fan-out으로 더한다(서버 RecordMemory의 데모 거울) — 검토를
 *  마친 조각들(text·mood·intensity·valence)을 그대로 별로 빚는다. 같은 일기의 조각은 같은 본문·
 *  recordId(baseId)를 공유하고(불변 1 record — 헌법1), intra_entry 0.8로 묶이며, 대표 조각이
 *  production 식으로 기존 일기와 이어진다(linkNewDiary). 데모 전용 분절·키워드 추정은 없다 —
 *  조각은 프리셋이 미리 담아 온다(change 25). recordId(baseId)와 조각 id들을 돌려준다. */
function createDemoDiary(
  body: string,
  entryDate: string,
  frags: { text: string; mood: Mood; intensity: number; valence: number }[],
): { recordId: string; memoryIds: string[] } {
  ensureSeeded()
  const nowIso = new Date(virtualNowMs()).toISOString()
  const baseId = `demo-new-${crypto.randomUUID()}`
  const multi = frags.length > 1

  const ids: string[] = []
  frags.forEach((fr, i) => {
    const id = multi ? `${baseId}-f${i}` : baseId
    const intensity = fr.intensity > 0 ? fr.intensity : 0.65
    // 원본은 공유(불변 1 record — 헌법1): 어느 조각 별을 열어도 같은 일기가 보인다.
    records.set(
      id,
      create(RecordSchema, { memoryId: id, body, entryDate, mood: fr.mood, intensity, createdAt: nowIso }),
    )
    addedStars.push(
      create(StarSchema, {
        memoryId: id,
        mood: fr.mood,
        intensity,
        valence: fr.valence, // production이 조각별로 추출·영속하는 정동(데모는 프리셋이 담아 온다)
        lastRecalledAt: nowIso, // 방금 만든 별 → 가장 밝게
        recordId: baseId, // spec 28: 같은 일기의 조각은 baseId로 묶인다(단일 조각이면 id===baseId)
        fragmentIndex: i,
        recallCount: 1n, // spec 07: 막 만든 별 → 회상 1회(부호화)
      }),
    )
    if (multi) fragmentTextsById.set(id, fr.text) // 다조각이면 별 → 조각 텍스트(단일은 본문 폴백)
    ids.push(id)
  })

  // 일내 결속(within-event binding): 모든 조각 쌍을 production intra_entry 0.8로.
  for (let i = 0; i < ids.length; i++)
    for (let k = i + 1; k < ids.length; k++)
      upsertEdge(ids[i], ids[k], VALUES.connection.intraEntryWeight, 'intra_entry', nowIso)

  // 교차 일기 연결: 대표(첫) 조각을 기존 일기와 production 식으로 잇는다.
  linkNewDiary(ids[0], frags[0].mood, frags[0].valence, frags[0].intensity, entryDate, new Set(ids), nowIso)

  return { recordId: baseId, memoryIds: ids }
}

/** 데모 작성 폼이 열 프리셋 일기를 고르고(페르소나별 회전) 본문·날짜를 돌려준다(change 25). 폼은 이
 *  본문을 read-only로 채운다. "별 나누기"·제출은 활성 프리셋(diary-presets)을 읽는다. */
export function beginDemoCompose(): { body: string; entryDate: string } {
  ensureSeeded()
  const preset = pickDiaryPreset(getDemoPersona())
  return { body: presetBody(preset), entryDate: demoToday() }
}

/** SegmentMemory 대체(데모) — 활성 프리셋 일기의 사전분절 조각을 검토용으로 돌려준다(AI 없이 즉시).
 *  valence는 mood에서 파생(서버는 조각별로 추출·영속). 작성 폼이 안 열렸으면 빈 배열. */
export function demoComposeSegments(): { text: string; mood: Mood; intensity: number; valence: number }[] {
  const preset = activeDiaryPreset()
  if (!preset) return []
  return preset.fragments.map((f) => ({
    text: f.text,
    mood: f.mood,
    intensity: f.intensity,
    valence: valenceOf(f.mood),
  }))
}

/** RecordMemory 대체(데모) — 검토를 마친 조각들을 별로 빚어 우주에 더한다(서버 미호출). 활성 프리셋을
 *  비워 다음 작성이 새 일기를 고르게 한다. {recordId, memoryIds}로 production RecordMemoryResult와 동형. */
export function demoRecordMemory(input: {
  body: string
  entryDate: string
  fragments: { text: string; mood: Mood; intensity: number; valence: number }[]
}): { recordId: string; memoryIds: string[] } {
  const result = createDemoDiary(input.body, input.entryDate, input.fragments)
  clearActiveDiaryPreset()
  return result
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

// QUICK_ENTRIES에 미리 쓴 일기가 없는 확장 감정(spec 29 6종)용 짧은 본문 — demoAddStar가 어떤
// 감정으로 불려도 본문 없는 별이 생기지 않게 한다. 내용은 시연용일 뿐(별 탄생·연결 생성 showcase).
const MOOD_FALLBACK_ENTRY: Partial<Record<Mood, { body: string; intensity: number }>> = {
  [Mood.EXCITEMENT]: { body: '내일 떠날 생각에 짐을 몇 번이나 다시 쌌다. 가슴이 자꾸 두근거린다.', intensity: 0.8 },
  [Mood.GRATITUDE]: { body: '바쁜데도 시간을 내준 사람에게 오래 마음을 전했다. 받은 게 참 많은 하루.', intensity: 0.6 },
  [Mood.RELIEF]: { body: '결과를 확인하고 나서야 참았던 숨이 길게 나왔다. 이제야 어깨가 내려간다.', intensity: 0.55 },
  [Mood.STRESS]: { body: '할 일이 한꺼번에 몰렸다. 머릿속이 꽉 차서 어디부터 손대야 할지 모르겠다.', intensity: 0.7 },
  [Mood.TIRED]: { body: '하루 종일 서 있었더니 집에 오자마자 그대로 누워버렸다. 손가락 하나 움직이기 싫다.', intensity: 0.5 },
  [Mood.EMPTINESS]: { body: '할 일을 다 했는데도 마음 한구석이 텅 빈 것 같다. 무엇으로도 잘 채워지지 않는다.', intensity: 0.5 },
}

/** 한 감정의 데모 일기 본문을 고른다 — 미리 쓴 일기(QUICK_ENTRIES)가 있으면 그중 무작위,
 *  없으면 그 감정의 fallback 문장. 단일 문단이라 호출자가 mood를 그대로 별에 새긴다. */
function entryForMood(mood: Mood): { body: string; intensity: number } {
  const pool = QUICK_ENTRIES.filter((q) => q.mood === mood)
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)]
  return MOOD_FALLBACK_ENTRY[mood] ?? { body: '오늘의 한 조각을 별로 띄운다.', intensity: 0.5 }
}

/** 데모 전용 "별 띄우기"(테스트·내부 시뮬레이션 경로): 고른 감정·날짜로 단일 조각 별을 만든다.
 *  본문은 그 감정으로 미리 써 둔 일기 중 무작위 — 내용은 시연용일 뿐. 새 별 id를 돌려준다. */
export function demoAddStar(mood: Mood, entryDate: string): string {
  const pick = entryForMood(mood)
  return createDemoDiary(pick.body, entryDate, [
    { text: pick.body, mood, intensity: pick.intensity, valence: valenceOf(mood) },
  ]).memoryIds[0]
}

// 데모 전용 "다감정 하루 띄우기"(테스트·내부 시뮬레이션 경로) — 장면마다 감정이 갈리는 미리
// 분절해 둔 다감정 일기들. createDemoDiary가 조각마다 색이 다른 별로 fan-out한다.
const MULTI_SCENE_ENTRIES: { text: string; mood: Mood; intensity: number }[][] = [
  [
    { text: '늦잠을 자고 일어나 창을 여니 볕이 좋아서 괜히 웃었다. 오랜만에 느긋한 아침.', mood: Mood.JOY, intensity: 0.6 },
    { text: '오후에 메일 하나로 일정이 전부 꼬였다. 짜증이 솟았지만 어디에 화를 내야 할지도 몰랐다.', mood: Mood.ANGER, intensity: 0.65 },
    { text: '저녁엔 좋아하는 노래를 틀어놓고 방을 정리했다. 마음이 조금씩 차분해졌다.', mood: Mood.CALM, intensity: 0.5 },
  ],
  [
    { text: '발표 직전까지 손이 떨렸다. 실수하면 어쩌나 하는 걱정이 멈추지 않았다.', mood: Mood.FEAR, intensity: 0.65 },
    { text: '끝나고 나니 다행이라는 말밖에 안 나왔다. 어깨가 한꺼번에 풀렸다.', mood: Mood.RELIEF, intensity: 0.6 },
    { text: '집에 오는 길, 고생했다며 친구가 사준 따뜻한 국밥. 고마워서 코끝이 찡했다.', mood: Mood.GRATITUDE, intensity: 0.7 },
  ],
]

/** 데모 전용 "다감정 하루 띄우기": 여러 감정이 담긴 미리 분절한 일기 한 편을 조각 별 fan-out으로
 *  띄운다 — 색이 다른 N개 별이 강한 일내 선으로 묶여 등장한다. 태어난 조각 id들을 돌려준다. */
export function demoAddMultiSceneStar(entryDate: string): string[] {
  const frs = MULTI_SCENE_ENTRIES[Math.floor(Math.random() * MULTI_SCENE_ENTRIES.length)]
  const body = frs.map((f) => f.text).join('\n\n')
  return createDemoDiary(
    body,
    entryDate,
    frs.map((f) => ({ ...f, valence: valenceOf(f.mood) })),
  ).memoryIds
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
    recordId: s.recordId, // 일기 단위 그룹 키(spec 28)도 보존
    fragmentIndex: s.fragmentIndex,
    lastRecalledAt,
    brightnessOffset: r?.brightnessOffset ?? s.brightnessOffset,
    hueShift: r?.hueShift ?? s.hueShift,
    formSeedDelta: r?.formSeedDelta ?? s.formSeedDelta,
    version: r?.version ?? s.version,
    abstractionStage: abstractionStageById.get(s.memoryId) ?? s.abstractionStage, // 단조 요지 단계 보존(교체로 0 되지 않게)
    recallCount: s.recallCount + 1n, // spec 07: 회상 재점화마다 +1(서버 RecallMemoryTouch 미러 — R↑·중앙 당김)
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

// 야간 공고화(change 20) 충실한 데모 포트 — 서버 RunConsolidation 패스의 결정론 부분을 미러한다
// (좌표 재안정화·재분배·spread는 라이브 force-sim이 refetch에서 도맡으므로 데이터엔 안 싣는다). 별·선은
// 절대 지우지 않는다(헌법2): ① 추상화 단계 반지름 트리거 단조 승급(요지), ② 링크 재가중(시간링크 약화/
// 의미링크 강화), ③ 약하고 안 쓰인 선 가지치기(빛만 바닥으로·마지막 연결 보호), ④ 고립 별 re-KNN 재연결.
// 모두 서버 spec/values.yaml 정전 값을 그대로 쓴다(데모 전용 노브 폐기 — change 27). 옛 나이 트리거
// formSeedDelta 요지 경로는 제거(이제 추상화 단계가 반지름으로 요지를 구동).
const WEAK_THRESHOLD = VALUES.consolidation.weakEdgeThreshold // 가지치기 weight 임계(서버 0.2)
const WEAK_IDLE_DAYS = VALUES.consolidation.weakEdgeIdleDays // 이보다 오래 안 쓰인 선이 가지치기 대상(서버 14)
const WEAK_FLOOR = VALUES.consolidation.weakEdgeFloor // 가지친 선이 가닿는 바닥(서버 0.05 — 0 아님, 헌법2)
const TEMPORAL_LINK_DECAY = VALUES.consolidation.temporalLinkDecay // 시간·일내 결속 밤당 약화(서버 0.97)
const SEMANTIC_LINK_GAIN = VALUES.consolidation.semanticLinkGain // 의미 링크 밤당 강화(서버 +0.01)
const SEM_CAP = VALUES.connection.semanticWeightCap // 의미 weight 상한(서버 0.79)
const REKNN_MIN_AGE_DAYS = VALUES.consolidation.reknnMinAgeDays // re-KNN 대상 최소 나이(서버 7일)

const edgeKey = (e: Synapse): string => `${e.aId}|${e.bId}` // base·added 모두 a<b 정렬 규약
const cloneEdge = (e: Synapse, weight: number): Synapse =>
  create(SynapseSchema, {
    aId: e.aId,
    bId: e.bId,
    weight,
    linkType: e.linkType,
    lastActivatedAt: e.lastActivatedAt,
    coActivationCount: e.coActivationCount,
  })

/** 각 별의 가장 센 연결 한 개씩의 edgeKey 집합 — 가지치기에서 보호해 어떤 별도 고립되지 않게 한다
 *  (degree≥1, 헌법2·서버 last-connection 보호). */
function strongestEdgePerNode(edges: Synapse[]): Set<string> {
  const best = new Map<string, { key: string; w: number }>()
  for (const e of edges) {
    const k = edgeKey(e)
    for (const node of [e.aId, e.bId]) {
      const cur = best.get(node)
      if (!cur || e.weight > cur.w) best.set(node, { key: k, w: e.weight })
    }
  }
  return new Set([...best.values()].map((v) => v.key))
}

/** RecordMemory처럼 데모 우주를 제자리에서 변환한다 — "밤 보내기"(change 20 포트). 별·선 개수는 그대로
 *  (삭제 0 — 헌법2). 불변 교체로 새 객체를 만들어 쿼리 캐시가 변경을 감지하게 한다. 배속 시계 드라이버가
 *  simulated 04:00 KST 경계를 지날 때마다 1회씩 호출한다(change 24·멱등). */
export function demoConsolidate(): void {
  ensureSeeded()
  const now = virtualNowMs()
  // 가지친(severed) 선은 죽은 연결이라 연결성·반지름·요지에 기여하지 않는다(서버 radius도 살아있는
  // 링크만 본다). 활성 선만으로 연결성을 잰다.
  const isSevered = (e: Synapse) => severedById.has(edgeKey(e))
  const active = [...baseSynapses, ...addedEdges].filter((e) => !isSevered(e))
  const conn = connectednessById(active)

  // ① 추상화 단계 반지름 트리거 승급(GREATEST) — 멀어진 별일수록 형태가 한 단계 단순(요지). 단계가
  //    올라간 별만 불변 교체(요지는 회상 아님 → lastRecalledAt 보존).
  for (const s of [...baseStars, ...addedStars]) {
    const recalledMs = Date.parse(s.lastRecalledAt)
    if (!Number.isFinite(recalledMs)) continue
    const radius = starRadius(Number(s.recallCount), s.intensity, recalledMs, now, conn.get(s.memoryId) ?? 0)
    const before = abstractionStageById.get(s.memoryId) ?? 0
    if (raiseAbstractionStage(s.memoryId, radius) !== before)
      replaceStar(s.memoryId, (st) => renewStar(st, st.lastRecalledAt))
  }

  // ② 링크 재가중: 시간·일내 결속은 약화(×0.97 — 시간 창이 녹는다, GREATEST(0,…)), 의미·개체·공동회상은
  //    강화(+0.01, 캡 0.79). 가지친 선은 건드리지 않는다(서버 ReweightLinks가 severed=false만 — 되살아나
  //    0.79로 기어오르거나 바닥 밑으로 내려가지 않게). weight만 바뀐다(lastActivatedAt·개수 불변 — 삭제 0).
  const reweight = (list: Synapse[]) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      if (isSevered(e)) continue
      const temporal = e.linkType === 'temporal' || e.linkType === 'intra_entry'
      const w = temporal
        ? Math.max(0, e.weight * TEMPORAL_LINK_DECAY)
        : Math.min(SEM_CAP, e.weight + SEMANTIC_LINK_GAIN)
      list[i] = cloneEdge(e, w)
    }
  }
  reweight(baseSynapses)
  reweight(addedEdges)

  // ③ 가지치기: 약하고(weight<0.2) 안 쓰인(idle>14일) 선의 weight를 바닥(0.05)으로 낮추고 severed 표시 —
  //    어둑하게만, 삭제 0. 각 별의 가장 센 (활성) 연결은 보호(고립 방지, 헌법2). 재가중 후 weight 기준으로
  //    보호 집합을 다시 잡는다.
  const protectedEdges = strongestEdgePerNode(active)
  const prune = (list: Synapse[]) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      const key = edgeKey(e)
      if (severedById.has(key) || protectedEdges.has(key)) continue
      const idleDays = (now - Date.parse(e.lastActivatedAt)) / DAY_MS
      if (e.weight < WEAK_THRESHOLD && Number.isFinite(idleDays) && idleDays > WEAK_IDLE_DAYS) {
        list[i] = cloneEdge(e, WEAK_FLOOR)
        severedById.add(key)
      }
    }
  }
  prune(baseSynapses)
  prune(addedEdges)

  // ④ re-KNN: 살아있는 연결(severed 아님 + weight≥0.2)이 하나도 없고 오래된(>7일) 별을 의미 근사(같은
  //    감정)로 재연결한다 — 서버 re-KNN 후보(살아있는 healthy 링크 없음)의 데모 대응. 닮은 기억을 다시
  //    찾으면 upsertEdge가 끊겼던 선을 되살리거나(severed 해제) 새로 잇는다. 시드 우주는 연결돼 있어 거의
  //    발화 안 한다(연결 안전망·임베딩 없는 근사).
  const healthyDegree = new Map<string, number>()
  for (const e of [...baseSynapses, ...addedEdges]) {
    if (isSevered(e) || e.weight < WEAK_THRESHOLD) continue
    healthyDegree.set(e.aId, (healthyDegree.get(e.aId) ?? 0) + 1)
    healthyDegree.set(e.bId, (healthyDegree.get(e.bId) ?? 0) + 1)
  }
  const nowIso = new Date(now).toISOString()
  for (const s of [...baseStars, ...addedStars]) {
    if ((healthyDegree.get(s.memoryId) ?? 0) > 0) continue
    const recalledMs = Date.parse(s.lastRecalledAt)
    if (!Number.isFinite(recalledMs) || (now - recalledMs) / DAY_MS < REKNN_MIN_AGE_DAYS) continue
    const rec = records.get(s.memoryId)
    linkNewDiary(s.memoryId, s.mood, s.valence, s.intensity, rec?.entryDate ?? '', new Set([s.memoryId]), nowIso)
  }
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
  abstractionStageById.clear()
  severedById.clear()
  resetDemoClock()
}
