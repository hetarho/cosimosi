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
import { mulberry32 } from '../prng'
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

// 약 6개월간 주 2~3회 기록한 흐름을 **시뮬레이션**해 만든 더미 우주(scripts/gen-demo-universe.mjs).
// 손으로 엣지를 그리지 않고, 시간 순서대로 의미 유사도 top-k 링크 + temporal bonus로 시냅스가
// 생기고, 중간의 회상 세션이 일부 기억을 재점화(밝아짐→중앙)하며, 안 떠올린 건 감쇠(어둑→바깥)한
// 결과다 — 그래서 별들이 한 줄이 아니라 주제별 성단으로 서로 얽힌다(spec 22/38). 최근 = 밝게(작은
// daysAgo), 오래된 것 = 어둑하게(잠든 별 목록·회상 fly-to 체험용). 재생성하려면 위 스크립트를 돌려
// 출력을 여기 붙인다. export는 observe.ts(관찰 셀렉터)의 파생용 — 공개 API(index.ts)에는 안 올린다.
export const DEMO_ENTRIES: DemoEntry[] = [
  { id: 'demo-001', mood: Mood.EXCITEMENT, intensity: 0.6, daysAgo: 2, body: '새집 창으로 들어오는 아침 볕이 좋다. 여기서 맞는 첫 주말이 기대된다.' },
  { id: 'demo-002', mood: Mood.NEUTRAL, intensity: 0.42, daysAgo: 3, body: '이사 첫날. 텅 빈 방 한가운데 앉아 컵라면을 먹었다. 모든 게 새로 시작되는 묘한 고요함.' },
  { id: 'demo-003', mood: Mood.CALM, intensity: 0.55, daysAgo: 3, body: '새 책상을 정리했다. 새 팀, 새 자리. 반년 전 첫 출근의 내가 떠올라 잠깐 웃었다.' },
  { id: 'demo-004', mood: Mood.LOVE, intensity: 0.9, daysAgo: 4, body: '그 사람과 손을 잡고 걸었다. 별말 없었는데도 그 길이 끝나지 않길 바랐다.' },
  { id: 'demo-005', mood: Mood.LOVE, intensity: 0.7, daysAgo: 5, body: '길고양이 한 마리가 며칠째 현관 앞에 온다. 사료를 두니 경계하면서도 먹는다. 이름을 붙여버렸다.' },
  { id: 'demo-006', mood: Mood.SAD, intensity: 0.75, daysAgo: 5, body: '현관 앞 그 고양이가 며칠째 안 보인다. 밥그릇만 그대로다. 내가 너무 정을 줬나.' },
  { id: 'demo-007', mood: Mood.JOY, intensity: 0.62, daysAgo: 5, body: '이사 가기 전 동네 책방에 들렀다. 단골이 되기도 전에 떠나는 게 아쉬워 두 권을 샀다.' },
  { id: 'demo-008', mood: Mood.CALM, intensity: 0.5, daysAgo: 6, body: '대청소를 했다. 안 쓰는 물건을 한 봉지 비웠더니 방도 마음도 그만큼 가벼워졌다.' },
  { id: 'demo-009', mood: Mood.GRATITUDE, intensity: 0.72, daysAgo: 7, body: '이사 소식에 엄마가 제일 먼저 반찬부터 걱정한다. 그 잔소리가 오늘은 고마웠다.' },
  { id: 'demo-010', mood: Mood.SAD, intensity: 0.5, daysAgo: 9, body: '이직한 동료의 송별 모임. 웃으며 보냈지만 돌아오는 길은 좀 허전했다.' },
  { id: 'demo-011', mood: Mood.LOVE, intensity: 0.82, daysAgo: 11, body: '함께 새집을 보러 다녔다. 빈방을 보며 같은 상상을 하고 있다는 걸 알았다.' },
  { id: 'demo-012', mood: Mood.ANGER, intensity: 0.6, daysAgo: 12, body: '약속을 또 일방적으로 미뤘다. 화가 났다기보다, 매번 기다리는 쪽이 나라는 게 서글펐다.' },
  { id: 'demo-013', mood: Mood.LOVE, intensity: 0.8, daysAgo: 12, body: '다툰 뒤 처음으로 먼저 연락이 왔다. \'미안해\' 한마디에 며칠 묵은 게 스르르 풀렸다.' },
  { id: 'demo-014', mood: Mood.LOVE, intensity: 0.85, daysAgo: 12, body: '다툼 끝에 오래 이야기했다. 서로의 서툰 데를 조금 더 알게 됐다. 이런 게 가까워지는 거겠지.' },
  { id: 'demo-015', mood: Mood.STRESS, intensity: 0.55, daysAgo: 14, body: '이사를 결정했다. 짐을 싸려고 둘러보니 이 방에 쌓인 시간이 새삼 무겁다.' },
  { id: 'demo-016', mood: Mood.EXCITEMENT, intensity: 0.6, daysAgo: 16, body: '큰맘 먹고 러닝화를 샀다. 내일부터 뛴다 다짐했는데, 다짐만으로 벌써 설렌다.' },
  { id: 'demo-017', mood: Mood.RELIEF, intensity: 0.6, daysAgo: 16, body: '드디어 쉬지 않고 2km. 별것 아닌데 끝나고 혼자 주먹을 불끈 쥐었다.' },
  { id: 'demo-018', mood: Mood.JOY, intensity: 0.72, daysAgo: 16, body: '처음으로 5km를 완주했다. 다리가 풀렸지만 끝까지 뛰었다는 게 믿기지 않는다.' },
  { id: 'demo-019', mood: Mood.JOY, intensity: 0.9, daysAgo: 16, body: '10km 대회 완주. 결승선 앞에서 다리가 풀렸지만 끝까지 뛰었다. 반년 전의 나는 상상도 못 했다.' },
  { id: 'demo-020', mood: Mood.LOVE, intensity: 0.82, daysAgo: 19, body: '할머니 댁. 내 손을 꼭 잡고 \'밥은 잘 챙겨 먹니\' 하시는데 그 온기가 며칠째 남는다.' },
  { id: 'demo-021', mood: Mood.FEAR, intensity: 0.65, daysAgo: 19, body: '할머니가 입원하셨다는 연락. 별일 아니라는데도 자꾸 최악을 그리게 된다.' },
  { id: 'demo-022', mood: Mood.RELIEF, intensity: 0.7, daysAgo: 19, body: '할머니가 퇴원하셨다. 전화기 너머 목소리에 기운이 돌아 한참을 웃으며 통화했다.' },
  { id: 'demo-023', mood: Mood.GRATITUDE, intensity: 0.6, daysAgo: 26, body: '힘들 때 펼친 책의 한 문장이 오늘의 나를 정확히 통과했다. 누가 나 대신 써둔 것 같았다.' },
  { id: 'demo-024', mood: Mood.CALM, intensity: 0.46, daysAgo: 28, body: '퇴근길 골목에 목련이 폈다. 봄이 오는 걸 늘 꽃이 먼저 알려준다.' },
  { id: 'demo-025', mood: Mood.EXCITEMENT, intensity: 0.8, daysAgo: 31, body: '새 팀 첫 발표가 성공적으로 끝났다. 팀원들과 하이파이브할 때의 열기를 오래 기억하고 싶다.' },
  { id: 'demo-026', mood: Mood.JOY, intensity: 0.68, daysAgo: 35, body: '길에서 우연히 옛 친구를 만났다. 10년 만인데 어제 본 것처럼 떠들었다.' },
  { id: 'demo-027', mood: Mood.ANGER, intensity: 0.55, daysAgo: 39, body: '사소한 걸로 또 부딪혔다. 같은 얘기를 반복하는 우리가 잠깐 미웠다.' },
  { id: 'demo-028', mood: Mood.LOVE, intensity: 0.78, daysAgo: 43, body: '주말 본가. 엄마가 끓여준 미역국 냄새에 잠을 깼다. 사랑받는다는 건 이런 거구나.' },
  { id: 'demo-029', mood: Mood.FEAR, intensity: 0.6, daysAgo: 45, body: '다른 팀으로 옮길 기회가 왔다. 좋은 제안인데 왜 이렇게 무섭지. 고르는 일 자체가 두렵다.' },
  { id: 'demo-030', mood: Mood.STRESS, intensity: 0.62, daysAgo: 45, body: '팀 이동을 두고 계속 저울질. 어느 쪽을 골라도 후회할 것 같아 밤마다 천장만 본다.' },
  { id: 'demo-031', mood: Mood.RELIEF, intensity: 0.7, daysAgo: 45, body: '결국 팀을 옮기기로 했다. 정하고 나니, 무서웠던 게 무색하게 마음이 가벼워졌다.' },
  { id: 'demo-032', mood: Mood.CALM, intensity: 0.5, daysAgo: 51, body: '오랜만에 강변을 달렸다. 생각이 많을 땐 다리를 움직이는 게 약이 된다.' },
  { id: 'demo-033', mood: Mood.LOVE, intensity: 0.88, daysAgo: 63, body: '함께 본 영화가 끝나고도 한참 자리에 앉아 있었다. 말없이 있어도 편한 사람이 생겼다.' },
  { id: 'demo-034', mood: Mood.CALM, intensity: 0.5, daysAgo: 67, body: '비 오는 카페 창가. 따뜻한 라떼와 책 한 권. 아무것도 안 해도 되는 오후가 귀하다.' },
  { id: 'demo-035', mood: Mood.JOY, intensity: 0.6, daysAgo: 71, body: '지하철에서 읽던 책의 마지막 장을 덮었다. 다 읽기 아까워 일부러 천천히 읽었는데.' },
  { id: 'demo-036', mood: Mood.GRATITUDE, intensity: 0.7, daysAgo: 83, body: '엄마와 한 시간 통화. 별 내용 없었는데 끊고 나니 괜히 든든했다.' },
  { id: 'demo-037', mood: Mood.CALM, intensity: 0.52, daysAgo: 87, body: '프로젝트가 본격적으로 굴러간다. 바쁘지만 내가 맡은 자리가 분명해진 느낌.' },
  { id: 'demo-038', mood: Mood.SAD, intensity: 0.58, daysAgo: 95, body: '친한 동료가 이직한다. 축하한다고 했지만 빈 옆자리를 상상하니 마음이 가라앉았다.' },
  { id: 'demo-039', mood: Mood.CALM, intensity: 0.48, daysAgo: 103, body: '주말 아침 산책. 공기가 차고 맑았다. 이어폰을 빼고 새소리만 들으며 걸었다.' },
  { id: 'demo-040', mood: Mood.STRESS, intensity: 0.68, daysAgo: 111, body: '회의에서 또 말이 끊겼다. 끝까지 못 한 그 문장이 하루 종일 목에 걸려 있었다.' },
  { id: 'demo-041', mood: Mood.CALM, intensity: 0.5, daysAgo: 115, body: '오랜만에 손글씨로 편지를 썼다. 펜으로 쓰니 문장 하나하나가 천천히 익었다.' },
  { id: 'demo-042', mood: Mood.NEUTRAL, intensity: 0.4, daysAgo: 123, body: '특별할 것 없는 하루. 출근, 일, 점심, 일, 퇴근. 무탈하다는 게 어떤 날엔 가장 큰 다행이다.' },
  { id: 'demo-043', mood: Mood.EXCITEMENT, intensity: 0.7, daysAgo: 127, body: '내 아이디어가 처음으로 회의에서 채택됐다. 별것 아닌 기능 하나인데 종일 붕 떠 있었다.' },
  { id: 'demo-044', mood: Mood.LOVE, intensity: 0.85, daysAgo: 131, body: '그 사람과 처음 같이 요리를 했다. 다 태웠지만 주방에서 부딪힌 어깨가 자꾸 생각난다.' },
  { id: 'demo-045', mood: Mood.JOY, intensity: 0.65, daysAgo: 143, body: '오래 기다린 책이 도착했다. 포장을 뜯기 전 이 설렘이 제일 좋다.' },
  { id: 'demo-046', mood: Mood.CALM, intensity: 0.5, daysAgo: 147, body: '한강에서 노을을 봤다. 주황빛이 물 위로 길게 번지는 걸 한참 멍하니 바라봤다.' },
  { id: 'demo-047', mood: Mood.CALM, intensity: 0.5, daysAgo: 151, body: '이제 회의에서 질문 하나는 한다. 작은 건데도 내 자리가 조금 생긴 기분.' },
  { id: 'demo-048', mood: Mood.LOVE, intensity: 0.7, daysAgo: 157, body: '소개로 만난 사람과 두 번째 만남. 헤어지고도 대화가 자꾸 떠올라 잠을 설쳤다.' },
  { id: 'demo-049', mood: Mood.JOY, intensity: 0.7, daysAgo: 160, body: '오랜 친구와 보드게임. 배가 아플 때까지 웃었다. 어른이 되어도 이렇게 유치할 수 있어 다행이다.' },
  { id: 'demo-050', mood: Mood.TIRED, intensity: 0.5, daysAgo: 164, body: '첫 달리기. 5분 만에 숨이 턱까지 찼다. 작심삼일이 될까 무섭지만 일단 나갔다.' },
  { id: 'demo-051', mood: Mood.FEAR, intensity: 0.55, daysAgo: 168, body: '첫 주간회의에서 한마디도 못 했다. 다들 아는 얘기를 나만 모르는 것 같아 손에 땀이 났다.' },
  { id: 'demo-052', mood: Mood.LOVE, intensity: 0.8, daysAgo: 171, body: '엄마가 보낸 반찬 택배. 김치통 사이에 끼워둔 쪽지 한 장에 코끝이 시큰했다.' },
  { id: 'demo-053', mood: Mood.CALM, intensity: 0.45, daysAgo: 178, body: '퇴근길에 낯선 동네를 한 바퀴 걸었다. 길을 모르니 오히려 천천히 보게 된다.' },
  { id: 'demo-054', mood: Mood.STRESS, intensity: 0.6, daysAgo: 182, body: '첫 출근. 모든 게 낯설고 이름조차 못 외운 얼굴들 사이에서 하루 종일 긴장했다.' },
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
// DEMO_ENTRIES와 함께 scripts/gen-demo-universe.mjs 시뮬레이션이 산출한다(손으로 그리지 않음):
// 시간 순서대로 의미 유사도 top-k + temporal bonus로 시냅스가 생기고(weight는 cos 캡 0.79 부근),
// 회상 세션이 co_recall로 강화하며 lastActivated를 끌어올린다 → 주제별 성단이 서로 얽힌다.
export const DEMO_EDGES: DemoEdge[] = [
  { a: 'demo-001', b: 'demo-024', weight: 0.79, linkType: 'semantic', daysAgo: 2 },
  { a: 'demo-001', b: 'demo-034', weight: 0.79, linkType: 'semantic', daysAgo: 2 },
  { a: 'demo-001', b: 'demo-039', weight: 0.79, linkType: 'semantic', daysAgo: 2 },
  { a: 'demo-001', b: 'demo-046', weight: 0.79, linkType: 'semantic', daysAgo: 2 },
  { a: 'demo-001', b: 'demo-053', weight: 0.79, linkType: 'semantic', daysAgo: 2 },
  { a: 'demo-002', b: 'demo-008', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-002', b: 'demo-015', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-003', b: 'demo-040', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-003', b: 'demo-043', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-003', b: 'demo-047', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-003', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-003', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 3 },
  { a: 'demo-004', b: 'demo-012', weight: 0.79, linkType: 'entity', daysAgo: 4 },
  { a: 'demo-004', b: 'demo-013', weight: 0.79, linkType: 'entity', daysAgo: 4 },
  { a: 'demo-004', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 4 },
  { a: 'demo-004', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 4 },
  { a: 'demo-004', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 4 },
  { a: 'demo-005', b: 'demo-006', weight: 0.79, linkType: 'co_recall', daysAgo: 5 },
  { a: 'demo-007', b: 'demo-023', weight: 0.79, linkType: 'semantic', daysAgo: 5 },
  { a: 'demo-007', b: 'demo-035', weight: 0.79, linkType: 'semantic', daysAgo: 5 },
  { a: 'demo-007', b: 'demo-041', weight: 0.79, linkType: 'semantic', daysAgo: 5 },
  { a: 'demo-007', b: 'demo-045', weight: 0.79, linkType: 'semantic', daysAgo: 5 },
  { a: 'demo-008', b: 'demo-015', weight: 0.79, linkType: 'semantic', daysAgo: 6 },
  { a: 'demo-009', b: 'demo-020', weight: 0.62, linkType: 'semantic', daysAgo: 7 },
  { a: 'demo-009', b: 'demo-021', weight: 0.62, linkType: 'semantic', daysAgo: 7 },
  { a: 'demo-009', b: 'demo-028', weight: 0.79, linkType: 'entity', daysAgo: 7 },
  { a: 'demo-009', b: 'demo-036', weight: 0.79, linkType: 'entity', daysAgo: 7 },
  { a: 'demo-009', b: 'demo-052', weight: 0.79, linkType: 'entity', daysAgo: 7 },
  { a: 'demo-010', b: 'demo-026', weight: 0.79, linkType: 'entity', daysAgo: 9 },
  { a: 'demo-010', b: 'demo-038', weight: 0.79, linkType: 'entity', daysAgo: 9 },
  { a: 'demo-010', b: 'demo-049', weight: 0.79, linkType: 'entity', daysAgo: 9 },
  { a: 'demo-011', b: 'demo-012', weight: 0.79, linkType: 'entity', daysAgo: 11 },
  { a: 'demo-011', b: 'demo-013', weight: 0.79, linkType: 'entity', daysAgo: 11 },
  { a: 'demo-011', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 11 },
  { a: 'demo-011', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 11 },
  { a: 'demo-011', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 11 },
  { a: 'demo-012', b: 'demo-013', weight: 0.79, linkType: 'co_recall', daysAgo: 12 },
  { a: 'demo-012', b: 'demo-014', weight: 0.79, linkType: 'co_recall', daysAgo: 12 },
  { a: 'demo-012', b: 'demo-027', weight: 0.79, linkType: 'entity', daysAgo: 39 },
  { a: 'demo-012', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 63 },
  { a: 'demo-012', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 107 },
  { a: 'demo-012', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 107 },
  { a: 'demo-013', b: 'demo-014', weight: 0.79, linkType: 'co_recall', daysAgo: 12 },
  { a: 'demo-013', b: 'demo-027', weight: 0.79, linkType: 'entity', daysAgo: 39 },
  { a: 'demo-013', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 63 },
  { a: 'demo-013', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 91 },
  { a: 'demo-013', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 91 },
  { a: 'demo-014', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 23 },
  { a: 'demo-014', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 23 },
  { a: 'demo-014', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 23 },
  { a: 'demo-016', b: 'demo-017', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-016', b: 'demo-018', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-016', b: 'demo-019', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-016', b: 'demo-032', weight: 0.79, linkType: 'semantic', daysAgo: 51 },
  { a: 'demo-016', b: 'demo-050', weight: 0.79, linkType: 'semantic', daysAgo: 164 },
  { a: 'demo-017', b: 'demo-018', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-017', b: 'demo-019', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-017', b: 'demo-032', weight: 0.79, linkType: 'semantic', daysAgo: 51 },
  { a: 'demo-017', b: 'demo-050', weight: 0.79, linkType: 'semantic', daysAgo: 139 },
  { a: 'demo-018', b: 'demo-019', weight: 0.79, linkType: 'co_recall', daysAgo: 16 },
  { a: 'demo-018', b: 'demo-032', weight: 0.79, linkType: 'semantic', daysAgo: 51 },
  { a: 'demo-018', b: 'demo-050', weight: 0.79, linkType: 'semantic', daysAgo: 99 },
  { a: 'demo-019', b: 'demo-032', weight: 0.79, linkType: 'semantic', daysAgo: 17 },
  { a: 'demo-019', b: 'demo-050', weight: 0.79, linkType: 'semantic', daysAgo: 17 },
  { a: 'demo-020', b: 'demo-021', weight: 0.79, linkType: 'co_recall', daysAgo: 19 },
  { a: 'demo-020', b: 'demo-022', weight: 0.79, linkType: 'co_recall', daysAgo: 19 },
  { a: 'demo-020', b: 'demo-028', weight: 0.62, linkType: 'semantic', daysAgo: 43 },
  { a: 'demo-020', b: 'demo-036', weight: 0.62, linkType: 'semantic', daysAgo: 83 },
  { a: 'demo-020', b: 'demo-052', weight: 0.62, linkType: 'semantic', daysAgo: 135 },
  { a: 'demo-021', b: 'demo-022', weight: 0.79, linkType: 'co_recall', daysAgo: 19 },
  { a: 'demo-021', b: 'demo-028', weight: 0.62, linkType: 'semantic', daysAgo: 43 },
  { a: 'demo-021', b: 'demo-036', weight: 0.62, linkType: 'semantic', daysAgo: 55 },
  { a: 'demo-021', b: 'demo-052', weight: 0.62, linkType: 'semantic', daysAgo: 55 },
  { a: 'demo-022', b: 'demo-028', weight: 0.62, linkType: 'semantic', daysAgo: 20 },
  { a: 'demo-022', b: 'demo-036', weight: 0.62, linkType: 'semantic', daysAgo: 20 },
  { a: 'demo-022', b: 'demo-052', weight: 0.62, linkType: 'semantic', daysAgo: 20 },
  { a: 'demo-023', b: 'demo-035', weight: 0.79, linkType: 'semantic', daysAgo: 26 },
  { a: 'demo-023', b: 'demo-041', weight: 0.79, linkType: 'semantic', daysAgo: 26 },
  { a: 'demo-023', b: 'demo-045', weight: 0.79, linkType: 'semantic', daysAgo: 26 },
  { a: 'demo-024', b: 'demo-034', weight: 0.79, linkType: 'semantic', daysAgo: 28 },
  { a: 'demo-024', b: 'demo-039', weight: 0.79, linkType: 'semantic', daysAgo: 28 },
  { a: 'demo-024', b: 'demo-046', weight: 0.79, linkType: 'semantic', daysAgo: 28 },
  { a: 'demo-024', b: 'demo-053', weight: 0.79, linkType: 'semantic', daysAgo: 28 },
  { a: 'demo-025', b: 'demo-040', weight: 0.79, linkType: 'semantic', daysAgo: 31 },
  { a: 'demo-025', b: 'demo-043', weight: 0.79, linkType: 'semantic', daysAgo: 31 },
  { a: 'demo-025', b: 'demo-047', weight: 0.79, linkType: 'semantic', daysAgo: 31 },
  { a: 'demo-025', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 31 },
  { a: 'demo-025', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 31 },
  { a: 'demo-026', b: 'demo-038', weight: 0.79, linkType: 'entity', daysAgo: 35 },
  { a: 'demo-026', b: 'demo-049', weight: 0.79, linkType: 'entity', daysAgo: 35 },
  { a: 'demo-027', b: 'demo-033', weight: 0.79, linkType: 'entity', daysAgo: 39 },
  { a: 'demo-027', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 39 },
  { a: 'demo-027', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 39 },
  { a: 'demo-028', b: 'demo-036', weight: 0.79, linkType: 'entity', daysAgo: 43 },
  { a: 'demo-028', b: 'demo-052', weight: 0.79, linkType: 'entity', daysAgo: 43 },
  { a: 'demo-029', b: 'demo-030', weight: 0.79, linkType: 'co_recall', daysAgo: 45 },
  { a: 'demo-029', b: 'demo-031', weight: 0.79, linkType: 'co_recall', daysAgo: 45 },
  { a: 'demo-029', b: 'demo-040', weight: 0.7, linkType: 'semantic', daysAgo: 75 },
  { a: 'demo-029', b: 'demo-043', weight: 0.7, linkType: 'semantic', daysAgo: 75 },
  { a: 'demo-029', b: 'demo-047', weight: 0.7, linkType: 'semantic', daysAgo: 75 },
  { a: 'demo-029', b: 'demo-051', weight: 0.7, linkType: 'semantic', daysAgo: 75 },
  { a: 'demo-029', b: 'demo-054', weight: 0.7, linkType: 'semantic', daysAgo: 75 },
  { a: 'demo-030', b: 'demo-031', weight: 0.79, linkType: 'co_recall', daysAgo: 45 },
  { a: 'demo-030', b: 'demo-043', weight: 0.7, linkType: 'semantic', daysAgo: 59 },
  { a: 'demo-030', b: 'demo-047', weight: 0.7, linkType: 'semantic', daysAgo: 59 },
  { a: 'demo-030', b: 'demo-051', weight: 0.7, linkType: 'semantic', daysAgo: 59 },
  { a: 'demo-030', b: 'demo-054', weight: 0.7, linkType: 'semantic', daysAgo: 59 },
  { a: 'demo-031', b: 'demo-047', weight: 0.7, linkType: 'semantic', daysAgo: 47 },
  { a: 'demo-031', b: 'demo-051', weight: 0.7, linkType: 'semantic', daysAgo: 47 },
  { a: 'demo-031', b: 'demo-054', weight: 0.7, linkType: 'semantic', daysAgo: 47 },
  { a: 'demo-032', b: 'demo-050', weight: 0.79, linkType: 'semantic', daysAgo: 51 },
  { a: 'demo-033', b: 'demo-044', weight: 0.79, linkType: 'entity', daysAgo: 63 },
  { a: 'demo-033', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 63 },
  { a: 'demo-034', b: 'demo-039', weight: 0.79, linkType: 'semantic', daysAgo: 67 },
  { a: 'demo-034', b: 'demo-046', weight: 0.79, linkType: 'semantic', daysAgo: 67 },
  { a: 'demo-034', b: 'demo-053', weight: 0.79, linkType: 'semantic', daysAgo: 67 },
  { a: 'demo-035', b: 'demo-041', weight: 0.79, linkType: 'semantic', daysAgo: 71 },
  { a: 'demo-035', b: 'demo-045', weight: 0.79, linkType: 'semantic', daysAgo: 71 },
  { a: 'demo-036', b: 'demo-052', weight: 0.79, linkType: 'entity', daysAgo: 83 },
  { a: 'demo-037', b: 'demo-040', weight: 0.79, linkType: 'semantic', daysAgo: 87 },
  { a: 'demo-037', b: 'demo-043', weight: 0.79, linkType: 'semantic', daysAgo: 87 },
  { a: 'demo-037', b: 'demo-047', weight: 0.79, linkType: 'semantic', daysAgo: 87 },
  { a: 'demo-037', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 87 },
  { a: 'demo-037', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 87 },
  { a: 'demo-038', b: 'demo-049', weight: 0.79, linkType: 'entity', daysAgo: 95 },
  { a: 'demo-039', b: 'demo-046', weight: 0.79, linkType: 'semantic', daysAgo: 103 },
  { a: 'demo-039', b: 'demo-053', weight: 0.79, linkType: 'semantic', daysAgo: 103 },
  { a: 'demo-040', b: 'demo-043', weight: 0.79, linkType: 'semantic', daysAgo: 111 },
  { a: 'demo-040', b: 'demo-047', weight: 0.79, linkType: 'semantic', daysAgo: 111 },
  { a: 'demo-040', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 111 },
  { a: 'demo-040', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 111 },
  { a: 'demo-041', b: 'demo-045', weight: 0.79, linkType: 'semantic', daysAgo: 115 },
  { a: 'demo-043', b: 'demo-047', weight: 0.79, linkType: 'semantic', daysAgo: 127 },
  { a: 'demo-043', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 127 },
  { a: 'demo-043', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 127 },
  { a: 'demo-044', b: 'demo-048', weight: 0.79, linkType: 'entity', daysAgo: 131 },
  { a: 'demo-046', b: 'demo-053', weight: 0.79, linkType: 'semantic', daysAgo: 147 },
  { a: 'demo-047', b: 'demo-051', weight: 0.79, linkType: 'semantic', daysAgo: 151 },
  { a: 'demo-047', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 151 },
  { a: 'demo-051', b: 'demo-054', weight: 0.79, linkType: 'semantic', daysAgo: 168 },
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
  const r = reshapeState.get(e.id)
  return create(StarSchema, {
    memoryId: e.id,
    mood: e.mood,
    intensity: e.intensity,
    lastRecalledAt: isoFrom(now, e.daysAgo),
    brightnessOffset: r?.brightnessOffset ?? 0,
    hueShift: r?.hueShift ?? 0,
    formSeedDelta: r?.formSeedDelta ?? 0,
    version: r?.version ?? 0,
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
// 흥분성 시간 창(~6h, 서버 tauExc와 동일) — 이 안에 회상된 별만 새 기억을 끌어당긴다(spec 22).
const HOT_WINDOW_MS = 6 * 60 * 60 * 1000

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
  if (hot) pushAddedEdge(first, hot.id, 0.66, 'semantic', nowIso)

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
 *  응답까지 같이 바뀌어 refetch가 no-op이 된다). 원본(records)은 불변(헌법1).
 *  누적 재성형 상태(spec 23)는 보존해 교체로 사라지지 않게 한다. */
function renewStar(s: Star, lastRecalledAt: string): Star {
  const r = reshapeState.get(s.memoryId)
  return create(StarSchema, {
    memoryId: s.memoryId,
    mood: s.mood,
    intensity: s.intensity,
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

// 재공고화 재성형 파라미터(spec 23 데모 — 서버 service.go·랜딩 카드와 같은 결).
const DEMO_PE_THRESHOLD = 0.15
const HUE_MAX_DEG = 28
const FORM_DELTA_MAX = 0.6
const clampDemo = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** 회상 거듭될수록(version↑) 별이 굳어 변화폭이 작아진다(강도 의존 — strength↑ ⇒ magnitude↓). */
function demoStrength(version: number): number {
  return clampDemo(0.22 * Math.log2(1 + version), 0, 0.85)
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

  const prev = reshapeState.get(memoryId) ?? { brightnessOffset: 0, hueShift: 0, formSeedDelta: 0, version: 0 }
  const magnitude = (0.1 + 0.12 * pe) * (1 - demoStrength(prev.version)) // strength↑ ⇒ 작아짐
  const dir = mulberry32(hashId(memoryId) * 2654435761 + attempt)() < 0.5 ? -1 : 1
  // 게인은 서버 service.go(hueGainDeg=60·formGain=0.5)와 일치시켜 체험 우주가 실서버와
  // 같은 폭으로 다시 빚어지게 한다(데모는 실 렌더러를 그대로 탄다 — 같은 aHueShift 경로).
  const next: DemoReshape = {
    brightnessOffset: clampDemo(prev.brightnessOffset + dir * clampDemo(magnitude, 0.1, 0.22), -1, 1),
    hueShift: clampDemo(prev.hueShift + dir * magnitude * 60, -HUE_MAX_DEG, HUE_MAX_DEG),
    formSeedDelta: clampDemo(prev.formSeedDelta + dir * magnitude * 0.5, -FORM_DELTA_MAX, FORM_DELTA_MAX),
    version: prev.version + 1,
  }
  reshapeState.set(memoryId, next)
  // 별을 불변 교체해 우주가 변형된 별을 그린다(lastRecalledAt은 demoMarkRecalled가 따로 전진).
  const nowIso = new Date(virtualNowMs()).toISOString()
  replaceStar(memoryId, (s) => renewStar(s, nowIso))
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
      hueShift: clampDemo(prev.hueShift + dir * step * 60, -HUE_MAX_DEG, HUE_MAX_DEG),
      formSeedDelta: clampDemo(prev.formSeedDelta + dir * step * 1.4, -FORM_DELTA_MAX, FORM_DELTA_MAX),
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
  reshapeState.clear()
  reshapeAttempts.clear()
  resetDemoClock()
}
