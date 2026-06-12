// 체험("demo") 모드 더미 우주 — 백엔드 호출 없이 프런트에 박아둔 별/시냅스/원본 일기.
// 단일 출처(DEMO_ENTRIES)에서 proto Star·Record·Synapse를 파생하므로 GetUniverse(별),
// RecallMemory(원본 일기), ListDormant(잠든 별)이 같은 id 공간을 공유해 일관된다.
// proto 모양 그대로 만들어(create) 기존 매퍼(mapStar/toSynapseEdge/recall 패널)를 그대로
// 재사용한다 — 체험 분기는 "데이터 출처"만 바꾸고 화면 코드는 건드리지 않는다.
//
// 런타임 상태(seed된 별 + 체험 중 추가한 별)는 모듈 변수에 둔다. 라우트 이동·리렌더에는
// 유지되고, 새로고침하면 모듈이 리로드되며 base만 다시 생기고 추가분은 사라진다(요구사항).
import { create } from '@bufbuild/protobuf'
import {
  Mood,
  RecordSchema,
  StarSchema,
  SynapseSchema,
  type Record as RecordMsg,
  type Star,
  type Synapse,
} from '@/shared/api'
import { virtualNowMs, resetDemoClock } from './clock'

const DAY_MS = 86_400_000

/** 더미 우주의 한 별 = 한 일기. daysAgo는 마지막 회상 경과일(밝기/잠듦을 좌우). */
export interface DemoEntry {
  id: string
  mood: Mood
  intensity: number
  /** 마지막 회상 후 경과일. ~100일 이상이면 잠든 별로 분류된다(활성도 ≤ 0.1). */
  daysAgo: number
  body: string
}

// 손으로 고른 일기들 — 감정/강도/회상 시점을 다양하게. 최근 = 밝게, 오래된 것 =
// 어둑하게(잠든 별 목록·회상 fly-to 체험용). 30개면 우주가 "별이 많다"고 읽힌다.
// export는 observe.ts(관찰 셀렉터)의 파생용 — 공개 API(index.ts)에는 올리지 않는다.
export const DEMO_ENTRIES: DemoEntry[] = [
  { id: 'demo-001', mood: Mood.JOY, intensity: 0.92, daysAgo: 0, body: '오늘 드디어 첫 마라톤 10km를 완주했다. 결승선 앞에서 다리가 풀렸지만 끝까지 뛰었다는 게 믿기지 않는다.' },
  { id: 'demo-002', mood: Mood.LOVE, intensity: 0.88, daysAgo: 1, body: '엄마가 끓여준 미역국 냄새에 잠을 깼다. 별거 아닌데 코끝이 시큰했다. 사랑받고 있다는 건 이런 거구나.' },
  { id: 'demo-003', mood: Mood.CALM, intensity: 0.55, daysAgo: 2, body: '비 오는 카페 창가 자리. 따뜻한 라떼 한 잔과 책 한 권. 아무것도 안 해도 되는 오후가 이렇게 귀할 줄이야.' },
  { id: 'demo-004', mood: Mood.JOY, intensity: 0.7, daysAgo: 3, body: '오랜만에 친구들과 보드게임. 배가 아플 때까지 웃었다. 어른이 되어도 이렇게 유치하게 놀 수 있어 다행이다.' },
  { id: 'demo-005', mood: Mood.FEAR, intensity: 0.6, daysAgo: 4, body: '내일 발표 생각에 새벽까지 잠이 안 온다. 잘 해낼 수 있을까. 자료는 다 외웠는데도 손이 떨린다.' },
  { id: 'demo-006', mood: Mood.CALM, intensity: 0.48, daysAgo: 6, body: '퇴근길 한강에서 노을을 봤다. 주황빛이 물 위로 길게 번지는 걸 한참 멍하니 바라봤다.' },
  { id: 'demo-007', mood: Mood.SAD, intensity: 0.65, daysAgo: 7, body: '키우던 화분이 끝내 시들었다. 매일 물을 줬는데도. 무언가를 돌보는 일은 늘 마음 한구석을 졸이게 한다.' },
  { id: 'demo-008', mood: Mood.JOY, intensity: 0.8, daysAgo: 9, body: '프로젝트 데모가 성공적으로 끝났다. 팀원들과 하이파이브할 때의 그 열기를 오래 기억하고 싶다.' },
  { id: 'demo-009', mood: Mood.ANGER, intensity: 0.72, daysAgo: 11, body: '회의에서 또 말이 끊겼다. 끝까지 못 한 그 문장이 하루 종일 목에 걸려 있었다.' },
  { id: 'demo-010', mood: Mood.LOVE, intensity: 0.84, daysAgo: 13, body: '할머니 댁에 다녀왔다. 내 손을 꼭 잡고 "밥은 잘 챙겨 먹니" 물으시는데, 그 온기가 며칠째 손에 남아 있다.' },
  // ▼ 분절 데모 후보(spec 20 T014 → 21에서 사용): 하루 안에 장면 전환(출근→일→점심→퇴근)이
  //   있는 다장면 엔트리 — 21의 "1 일기 → N 조각 별" 체험이 이 엔트리를 분절 시연에 쓴다
  //   (필요 시 21에서 본문을 장면별 감정이 갈리는 문단으로 보강).
  { id: 'demo-011', mood: Mood.NEUTRAL, intensity: 0.4, daysAgo: 16, body: '특별할 것 없는 하루. 출근, 일, 점심, 일, 퇴근. 그래도 무탈하다는 게 어떤 날엔 가장 큰 다행이다.' },
  { id: 'demo-012', mood: Mood.CALM, intensity: 0.52, daysAgo: 19, body: '주말 아침 산책. 공기가 차고 맑았다. 이어폰을 빼고 새소리만 들으며 걸었다.' },
  { id: 'demo-013', mood: Mood.JOY, intensity: 0.76, daysAgo: 22, body: '오래 기다린 책이 도착했다. 포장을 뜯는 순간의 설렘. 첫 장을 펼치기 전 이 기분이 제일 좋다.' },
  { id: 'demo-014', mood: Mood.SAD, intensity: 0.58, daysAgo: 27, body: '친한 동료가 이직한다. 축하한다고 말했지만, 빈 옆자리를 상상하니 마음이 가라앉았다.' },
  { id: 'demo-015', mood: Mood.FEAR, intensity: 0.5, daysAgo: 31, body: '건강검진 결과를 기다리는 일주일. 별일 아닐 거라 되뇌면서도 자꾸 최악을 그리게 된다.' },
  { id: 'demo-016', mood: Mood.LOVE, intensity: 0.9, daysAgo: 34, body: '그 사람과 처음으로 같이 요리를 했다. 서툴러서 다 태웠지만, 주방에서 부딪힌 어깨가 자꾸 생각난다.' },
  { id: 'demo-017', mood: Mood.JOY, intensity: 0.68, daysAgo: 38, body: '길에서 우연히 옛 친구를 만났다. 10년 만인데 어제 본 것처럼 떠들었다. 인연은 참 신기하다.' },
  { id: 'demo-018', mood: Mood.ANGER, intensity: 0.6, daysAgo: 43, body: '약속을 또 일방적으로 미뤘다는 연락. 화가 났다기보다, 매번 내가 기다리는 쪽이라는 게 서글펐다.' },
  { id: 'demo-019', mood: Mood.CALM, intensity: 0.45, daysAgo: 49, body: '오랜만에 손글씨로 편지를 썼다. 자판이 아닌 펜으로 쓰니 문장 하나하나가 천천히 익었다.' },
  { id: 'demo-020', mood: Mood.NEUTRAL, intensity: 0.38, daysAgo: 56, body: '대청소를 했다. 안 쓰는 물건을 한 봉지 비웠더니 방이 조금 넓어졌고 마음도 그만큼 가벼워졌다.' },
  { id: 'demo-021', mood: Mood.SAD, intensity: 0.7, daysAgo: 64, body: '비 오는 밤, 옛 사진첩을 넘겼다. 그때는 몰랐던 표정들이 이제야 보인다. 좋았던 만큼 아렸다.' },
  { id: 'demo-022', mood: Mood.JOY, intensity: 0.82, daysAgo: 73, body: '첫 월급으로 부모님께 선물을 샀다. 받고 어쩔 줄 몰라 하시는 모습에 내가 더 신이 났다.' },
  { id: 'demo-023', mood: Mood.FEAR, intensity: 0.55, daysAgo: 88, body: '큰 결정을 앞두고 있다. 어느 쪽을 골라도 후회할 것 같아서, 고르는 일 자체가 무섭다.' },
  // ── 아래는 오래되어 어둑해진 "잠든 별"들(잠든 별 목록·회상 fly-to 체험용) ──
  { id: 'demo-024', mood: Mood.LOVE, intensity: 0.86, daysAgo: 118, body: '졸업식 날. 친구들과 사진을 수백 장 찍었다. 다 같이 모일 마지막 날일 줄, 그때는 정말 몰랐다.' },
  { id: 'demo-025', mood: Mood.CALM, intensity: 0.5, daysAgo: 142, body: '혼자 떠난 첫 기차 여행. 창밖으로 흘러가는 논밭을 보며 아무 생각도 하지 않았던 그 몇 시간.' },
  { id: 'demo-026', mood: Mood.SAD, intensity: 0.74, daysAgo: 176, body: '오래 키우던 강아지를 떠나보낸 날. 현관에서 더는 나를 기다리지 않는다는 게 가장 받아들이기 어려웠다.' },
  { id: 'demo-027', mood: Mood.JOY, intensity: 0.78, daysAgo: 213, body: '바다에서 처음으로 수영에 성공한 여름. 짠물을 잔뜩 먹었지만, 발이 안 닿는 곳에 떠 있던 그 자유로움.' },
  { id: 'demo-028', mood: Mood.NEUTRAL, intensity: 0.42, daysAgo: 268, body: '이사한 첫날. 텅 빈 방 한가운데 앉아 컵라면을 먹었다. 모든 게 새로 시작되는 묘한 고요함.' },
  { id: 'demo-029', mood: Mood.ANGER, intensity: 0.64, daysAgo: 331, body: '오해로 크게 다툰 날. 지나고 보면 별것 아닌 말 한마디였는데, 그때는 왜 그렇게 날이 섰을까.' },
  { id: 'demo-030', mood: Mood.LOVE, intensity: 0.95, daysAgo: 452, body: '아주 오래전 어느 봄, 벚꽃 아래에서. 흩날리는 꽃잎 사이로 웃던 얼굴이 아직도 가장 환하게 남아 있다.' },
]

// 별 사이 시냅스(연결선). a < b 무방향 규약. lastActivatedAt가 최근일수록 밝게 빛난다.
// weight·activation으로 굵기/밝기가 결정된다(11/12). 주제·시간·감정으로 묶었다.
export interface DemoEdge {
  a: string
  b: string
  weight: number
  linkType: string
  daysAgo: number
}
// export는 observe.ts(관찰 셀렉터)의 파생용 — 공개 API(index.ts)에는 올리지 않는다.
export const DEMO_EDGES: DemoEdge[] = [
  { a: 'demo-001', b: 'demo-008', weight: 0.8, linkType: 'semantic', daysAgo: 1 }, // 성취감
  { a: 'demo-002', b: 'demo-010', weight: 0.9, linkType: 'entity', daysAgo: 1 }, // 가족
  { a: 'demo-010', b: 'demo-024', weight: 0.55, linkType: 'entity', daysAgo: 5 },
  { a: 'demo-003', b: 'demo-006', weight: 0.7, linkType: 'semantic', daysAgo: 2 }, // 고요한 풍경
  { a: 'demo-006', b: 'demo-012', weight: 0.65, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-012', b: 'demo-025', weight: 0.4, linkType: 'semantic', daysAgo: 20 },
  { a: 'demo-004', b: 'demo-017', weight: 0.75, linkType: 'entity', daysAgo: 6 }, // 친구
  { a: 'demo-008', b: 'demo-009', weight: 0.5, linkType: 'temporal', daysAgo: 8 }, // 일
  { a: 'demo-009', b: 'demo-018', weight: 0.6, linkType: 'semantic', daysAgo: 10 }, // 분노
  { a: 'demo-005', b: 'demo-015', weight: 0.68, linkType: 'semantic', daysAgo: 12 }, // 불안
  { a: 'demo-015', b: 'demo-023', weight: 0.52, linkType: 'semantic', daysAgo: 30 },
  { a: 'demo-007', b: 'demo-026', weight: 0.6, linkType: 'semantic', daysAgo: 40 }, // 상실
  { a: 'demo-014', b: 'demo-021', weight: 0.45, linkType: 'co_recall', daysAgo: 25 },
  { a: 'demo-016', b: 'demo-030', weight: 0.7, linkType: 'co_recall', daysAgo: 60 }, // 사랑
  { a: 'demo-013', b: 'demo-019', weight: 0.5, linkType: 'semantic', daysAgo: 18 }, // 책/글
  { a: 'demo-011', b: 'demo-020', weight: 0.4, linkType: 'temporal', daysAgo: 22 }, // 평범한 정리
  { a: 'demo-020', b: 'demo-028', weight: 0.35, linkType: 'semantic', daysAgo: 90 },
  { a: 'demo-022', b: 'demo-001', weight: 0.6, linkType: 'co_recall', daysAgo: 14 }, // 첫 성취
  { a: 'demo-024', b: 'demo-017', weight: 0.5, linkType: 'temporal', daysAgo: 70 },
  { a: 'demo-027', b: 'demo-025', weight: 0.42, linkType: 'temporal', daysAgo: 120 }, // 여행/여름
  { a: 'demo-021', b: 'demo-026', weight: 0.55, linkType: 'co_recall', daysAgo: 80 },
  { a: 'demo-018', b: 'demo-029', weight: 0.48, linkType: 'semantic', daysAgo: 150 },
  { a: 'demo-002', b: 'demo-022', weight: 0.65, linkType: 'entity', daysAgo: 16 }, // 부모님
  { a: 'demo-016', b: 'demo-004', weight: 0.4, linkType: 'co_recall', daysAgo: 28 },
]

// ── 기억 분할(spec 21) — 1 일기 → N 조각 별 시드 데이터 ──
// 한 record body를 N개 조각 별이 공유한다(각자 다른 mood, 조각끼리 intra_entry 0.8).
// recall은 memory id 단위라 조각 어느 별을 열어도 같은 원본 일기가 보인다(헌법1).
const FRAGMENT_BODY = [
  '아침 산책길, 어제 내린 비로 공기가 유리처럼 맑았다. 천천히 걸으며 오늘은 괜찮을 거라 생각했다.',
  '낮 회의에서 준비한 안건이 통째로 뒤집혔다. 말문이 막혔고, 자리로 돌아와서도 한참 손이 떨렸다.',
  '밤에 친구의 긴 전화. "네 잘못이 아니야"라는 말에 하루 종일 조여 있던 가슴이 스르르 풀렸다.',
].join('\n\n')

// id prefix는 DEMO_ENTRIES의 `demo-0NN`과 다른 네임스페이스(`demo-frag-`)라
// 엔트리가 늘어나도 충돌하지 않는다.
const DEMO_FRAGMENTS: { id: string; mood: Mood; intensity: number; daysAgo: number }[] = [
  { id: 'demo-frag-f0', mood: Mood.CALM, intensity: 0.5, daysAgo: 1 },
  { id: 'demo-frag-f1', mood: Mood.ANGER, intensity: 0.78, daysAgo: 1 },
  { id: 'demo-frag-f2', mood: Mood.RELIEF, intensity: 0.62, daysAgo: 1 },
]

function isoFrom(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString()
}

function dateFrom(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10) // YYYY-MM-DD
}

function toStar(now: number, e: DemoEntry): Star {
  return create(StarSchema, {
    memoryId: e.id,
    mood: e.mood,
    intensity: e.intensity,
    lastRecalledAt: isoFrom(now, e.daysAgo),
  })
}

function toRecord(now: number, e: DemoEntry): RecordMsg {
  return create(RecordSchema, {
    memoryId: e.id,
    body: e.body,
    entryDate: dateFrom(now, e.daysAgo),
    mood: e.mood,
    intensity: e.intensity,
    createdAt: isoFrom(now, e.daysAgo),
  })
}

// ── 런타임 상태(모듈 수명 = 탭 세션, 새로고침 시 초기화) ──
let seededAt = 0
let baseStars: Star[] = []
let baseSynapses: Synapse[] = []
const records = new Map<string, RecordMsg>() // base + 체험 중 추가분, recall이 읽는다
const addedStars: Star[] = [] // 체험 중 추가한 별(라우트 이동에도 유지, 새로고침 시 소멸)
const addedEdges: Synapse[] = [] // 체험 중 추가한 별의 연결(시냅스 생성 이론 시연, spec 19)

function ensureSeeded(): void {
  if (seededAt) return
  // 가상 now 기준 시드 — 진입 직후엔 offset=0이라 실제 now와 같고, 이후 시간 머신이
  // offset을 키우면 같은 데이터가 그만큼 "늙은" 것으로 파생된다(spec 19).
  seededAt = virtualNowMs()
  baseStars = DEMO_ENTRIES.map((e) => toStar(seededAt, e))
  baseSynapses = DEMO_EDGES.map((ed) =>
    create(SynapseSchema, {
      aId: ed.a,
      bId: ed.b,
      weight: ed.weight,
      linkType: ed.linkType,
      lastActivatedAt: isoFrom(seededAt, ed.daysAgo),
    }),
  )
  for (const e of DEMO_ENTRIES) records.set(e.id, toRecord(seededAt, e))

  // 분할 시드(spec 21): 한 일기에서 태어난 색 다른 3개의 별 + 강한 일내 결속.
  for (const f of DEMO_FRAGMENTS) {
    baseStars.push(toStar(seededAt, { ...f, body: FRAGMENT_BODY }))
    records.set(f.id, toRecord(seededAt, { ...f, body: FRAGMENT_BODY }))
  }
  for (let i = 0; i < DEMO_FRAGMENTS.length; i++) {
    for (let k = i + 1; k < DEMO_FRAGMENTS.length; k++) {
      const [aId, bId] =
        DEMO_FRAGMENTS[i].id < DEMO_FRAGMENTS[k].id
          ? [DEMO_FRAGMENTS[i].id, DEMO_FRAGMENTS[k].id]
          : [DEMO_FRAGMENTS[k].id, DEMO_FRAGMENTS[i].id]
      baseSynapses.push(
        create(SynapseSchema, {
          aId,
          bId,
          weight: 0.8,
          linkType: 'intra_entry',
          lastActivatedAt: isoFrom(seededAt, DEMO_FRAGMENTS[i].daysAgo),
        }),
      )
    }
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

/** RecallMemory 대체: 원본 일기. 없는 id면 undefined(패널이 에러 처리). */
export function demoRecall(memoryId: string): RecordMsg | undefined {
  ensureSeeded()
  return records.get(memoryId)
}

// 새 별이 만드는 데모 연결 수 상한 — 우주를 어지럽히지 않는 선에서 "연결이 생긴다"를 보인다.
const ADD_SAME_DAY_LINKS = 2
const ADD_SAME_MOOD_LINKS = 1

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
  return [...scenes.slice(0, DEMO_MAX_FRAGMENTS - 1), scenes.slice(DEMO_MAX_FRAGMENTS - 1).join(' ')]
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
        lastRecalledAt: nowIso, // 방금 만든 별 → 가장 밝게
      }),
    )
    ids.push(id)
  })

  // 일내 결속(within-event binding): 모든 조각 쌍을 강한 고정 가중치로.
  for (let i = 0; i < ids.length; i++) {
    for (let k = i + 1; k < ids.length; k++) {
      pushAddedEdge(ids[i], ids[k], 0.8, 'intra_entry', nowIso)
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
  for (const r of sameDay) pushAddedEdge(first, r.memoryId, 0.55, 'temporal', nowIso)

  // 의미 근사: 첫 조각과 같은 mood의 최신 일기와 잇는다(같은 날로 이미 이어진 별은 제외).
  const firstMood = records.get(first)?.mood
  const linkedIds = new Set(sameDay.map((r) => r.memoryId))
  const sameMood = others
    .filter((r) => r.mood === firstMood && !linkedIds.has(r.memoryId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, ADD_SAME_MOOD_LINKS)
  for (const r of sameMood) pushAddedEdge(first, r.memoryId, 0.6, 'semantic', nowIso)

  return ids
}

// 시뮬 패널 "별 띄우기"용 — 감정별로 미리 써 둔 짧은 일기 10개. 체험에서 내용 자체는
// 중요하지 않으므로(별 탄생·연결 생성을 보여주는 용도) 무작위로 하나를 골라 띄운다.
const QUICK_ENTRIES: { mood: Mood; intensity: number; body: string }[] = [
  { mood: Mood.JOY, intensity: 0.85, body: '드디어 합격 메일이 왔다. 몇 번을 다시 읽었는지 모른다. 오늘 밤은 잠이 안 올 것 같다.' },
  { mood: Mood.JOY, intensity: 0.7, body: '길에서 동전 노래방을 발견하고 두 곡 불렀다. 목은 쉬었지만 기분은 최고.' },
  { mood: Mood.LOVE, intensity: 0.9, body: '오늘 손을 잡고 걸었다. 별말 없이 걸었는데도 그 길이 끝나지 않길 바랐다.' },
  { mood: Mood.LOVE, intensity: 0.75, body: '동생이 말없이 내 책상에 귤을 까놓고 갔다. 다정함은 이렇게 조용히 온다.' },
  { mood: Mood.CALM, intensity: 0.5, body: '창문을 열어두고 빗소리를 들으며 차를 마셨다. 아무 일도 없는 저녁이 좋다.' },
  { mood: Mood.CALM, intensity: 0.45, body: '아침 일찍 동네를 한 바퀴 걸었다. 공기가 차고 깨끗해서 머리가 맑아졌다.' },
  { mood: Mood.SAD, intensity: 0.6, body: '오래 쓰던 머그컵이 깨졌다. 그냥 컵일 뿐인데, 마음 한구석이 같이 금 갔다.' },
  { mood: Mood.ANGER, intensity: 0.65, body: '줄을 서 있는데 누가 아무렇지 않게 새치기를 했다. 한마디 못 한 내가 더 분하다.' },
  { mood: Mood.FEAR, intensity: 0.55, body: '내일 결과 발표다. 휴대폰을 쥐었다 놓았다 하며 하루를 다 써버렸다.' },
  { mood: Mood.NEUTRAL, intensity: 0.4, body: '장을 보고, 빨래를 개고, 일찍 누웠다. 적당히 평범해서 나쁘지 않은 하루.' },
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
 *  응답까지 같이 바뀌어 refetch가 no-op이 된다). 원본(records)은 불변(헌법1). */
export function demoMarkRecalled(memoryId: string): void {
  ensureSeeded()
  const nowIso = new Date(virtualNowMs()).toISOString()
  const renew = (s: Star): Star =>
    create(StarSchema, {
      memoryId: s.memoryId,
      mood: s.mood,
      intensity: s.intensity,
      lastRecalledAt: nowIso,
    })
  const bi = baseStars.findIndex((s) => s.memoryId === memoryId)
  if (bi >= 0) {
    baseStars[bi] = renew(baseStars[bi])
    return
  }
  const ai = addedStars.findIndex((s) => s.memoryId === memoryId)
  if (ai >= 0) addedStars[ai] = renew(addedStars[ai])
}

/** 체험 종료 시 추가분·가상 시계를 비워 다음 진입을 깨끗하게 한다(base는 다음 ensureSeeded에서 재생성). */
export function resetDemo(): void {
  seededAt = 0
  baseStars = []
  baseSynapses = []
  addedStars.length = 0
  addedEdges.length = 0
  records.clear()
  resetDemoClock()
}
