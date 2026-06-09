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

const DAY_MS = 86_400_000

/** 더미 우주의 한 별 = 한 일기. daysAgo는 마지막 회상 경과일(밝기/잠듦을 좌우). */
interface DemoEntry {
  id: string
  mood: Mood
  intensity: number
  /** 마지막 회상 후 경과일. ~100일 이상이면 잠든 별로 분류된다(활성도 ≤ 0.1). */
  daysAgo: number
  body: string
}

// 손으로 고른 일기들 — 감정/강도/회상 시점을 다양하게. 최근 = 밝게, 오래된 것 =
// 어둑하게(잠든 별 목록·회상 fly-to 체험용). 30개면 우주가 "별이 많다"고 읽힌다.
const DEMO_ENTRIES: DemoEntry[] = [
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
interface DemoEdge {
  a: string
  b: string
  weight: number
  linkType: string
  daysAgo: number
}
const DEMO_EDGES: DemoEdge[] = [
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

function ensureSeeded(): void {
  if (seededAt) return
  seededAt = Date.now()
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
}

/** GetUniverse 대체: base + 체험 중 추가한 별. 라우트 재진입 시에도 추가분이 유지된다. */
export function demoStars(): Star[] {
  ensureSeeded()
  return [...baseStars, ...addedStars]
}

/** GetUniverse 시냅스. (추가 별은 시냅스 없이 떠 있다 — 체험상 충분.) */
export function demoSynapses(): Synapse[] {
  ensureSeeded()
  return baseSynapses
}

/** RecallMemory 대체: 원본 일기. 없는 id면 undefined(패널이 에러 처리). */
export function demoRecall(memoryId: string): RecordMsg | undefined {
  ensureSeeded()
  return records.get(memoryId)
}

/** RecordMemory 대체: 새 별을 더미 우주에 추가하고 새 id를 돌려준다(API 호출 없음).
 *  추가분은 records(회상)와 addedStars(재진입 시 재시드)에 모두 반영된다. */
export function demoAddRecord(input: {
  body: string
  mood: Mood
  intensity: number
  entryDate: string
}): string {
  ensureSeeded()
  const id = `demo-new-${crypto.randomUUID()}`
  const now = Date.now()
  records.set(
    id,
    create(RecordSchema, {
      memoryId: id,
      body: input.body,
      entryDate: input.entryDate,
      mood: input.mood,
      intensity: input.intensity,
      createdAt: new Date(now).toISOString(),
    }),
  )
  addedStars.push(
    create(StarSchema, {
      memoryId: id,
      mood: input.mood,
      intensity: input.intensity,
      lastRecalledAt: new Date(now).toISOString(), // 방금 만든 별 → 가장 밝게
    }),
  )
  return id
}

/** 체험 종료 시 추가분을 비워 다음 진입을 깨끗하게 한다(base는 다음 ensureSeeded에서 재생성). */
export function resetDemo(): void {
  seededAt = 0
  baseStars = []
  baseSynapses = []
  addedStars.length = 0
  records.clear()
}
