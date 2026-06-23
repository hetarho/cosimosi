// 데모 프리셋 일기 **풀**(change 25·28) — 두 곳이 같은 콘텐츠 출처로 본다(단일 출처):
//   • 자유모드 "새 별 띄우기"(change 25) — production 작성 폼을 read-only로 재우며 본문에 채울
//     *읽기전용 일기* + "별 나누기"가 펼칠 *사전분절 조각*. 호출마다 다음 편으로 돌린다(pickDiaryPreset).
//   • 30일 genesis(change 28) — 매 simulated day 페르소나 토픽 분포(weight)대로 한 편을 뽑아
//     production 엔진으로 별을 빚는다(pickGenesisDiary). 난수가 세션마다 달라 서로 다른 우주가 자란다.
// 실서버는 LLM이 본문을 쓰고 사건 경계를 읽지만, 데모엔 네트워크가 없으므로 이 큐레이션 콘텐츠가 그
// 둘을 대체한다 — UI·상태머신·연결/밝기 로직은 production 그대로다(데모 고유는 이 콘텐츠뿐).
//
// 콘텐츠(배열)라 values.yaml 제외 규칙을 따른다 — 수치 노브가 아닌 문장/감정이므로 코드에 둔다.
import { Mood } from '@/shared/api'
import type { DemoPersona } from './flag'

/** 사전분절 조각 한 장 — production review 단계가 받는 {text, mood, intensity}와 동형(valence는
 *  data.ts가 mood에서 파생). 빈 줄로 합치면 본문이 된다. */
export interface PresetFragment {
  text: string
  mood: Mood
  intensity: number
}

/** 프리셋 일기 한 편 — read-only 본문(fragments를 빈 줄로 이은 것) + 사전분절 조각들. topic은 이 편의
 *  결을 가리키는 라벨(콘텐츠 설명용), weight는 genesis 샘플 분포 — 클수록 그 페르소나가 자주 쓰는 결. */
export interface DiaryPreset {
  topic: string
  weight: number
  fragments: PresetFragment[]
}

const joinBody = (frs: PresetFragment[]): string => frs.map((f) => f.text).join('\n\n')

/** 프리셋 일기의 본문(읽기전용 폼에 채워지는 텍스트). */
export function presetBody(p: DiaryPreset): string {
  return joinBody(p.fragments)
}

// 페르소나별 프리셋 일기 풀 — 하루 안에서 감정이 갈리는 다조각 일기로, "별 나누기"가 조각마다 색이
// 다른 별로 fan-out하는 걸 보인다(production 조각화 체험의 거울). genesis(change 28)는 이 풀에서 weight
// 분포대로 매일 한 편을 뽑아 30일 우주를 빚는다 — 페르소나마다 자주 쓰는 결(높은 weight)이 다르다.
const DIARY_PRESETS: Record<DemoPersona, DiaryPreset[]> = {
  student: [
    {
      topic: '발표',
      weight: 1.2,
      fragments: [
        { text: '발표 차례가 다가올수록 손끝이 차가워졌다. 슬라이드를 몇 번이나 다시 넘겼는지 모른다.', mood: Mood.FEAR, intensity: 0.7 },
        { text: '막상 입을 떼니 목소리가 떨리지 않았다. 끝나고 자리에 앉을 때 다리에 힘이 풀렸다.', mood: Mood.RELIEF, intensity: 0.6 },
        { text: '강의실을 나와 친구가 잘했다고 어깨를 두드려줬다. 그 한마디에 하루의 긴장이 다 녹았다.', mood: Mood.JOY, intensity: 0.65 },
      ],
    },
    {
      topic: '공부',
      weight: 1.5,
      fragments: [
        { text: '도서관에서 종일 같은 페이지만 붙잡고 있었다. 글자가 눈에 들어오지 않아 답답했다.', mood: Mood.STRESS, intensity: 0.6 },
        { text: '바람 쐬러 나온 옥상에서 노을을 한참 봤다. 별것 아닌데 마음이 조금 가라앉았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
    {
      topic: '본가',
      weight: 0.8,
      fragments: [
        { text: '오랜만에 본가에 내려가 엄마가 끓여준 된장찌개를 먹었다. 익숙한 냄새에 괜히 코끝이 시큰했다.', mood: Mood.LOVE, intensity: 0.75 },
        { text: '올라오는 기차에서 창밖을 보며 다음 학기를 떠올렸다. 잘 해내고 싶다는 마음이 조용히 들었다.', mood: Mood.CALM, intensity: 0.55 },
      ],
    },
    {
      topic: '연애',
      weight: 1.0,
      fragments: [
        { text: '같이 밥 먹자는 말을 며칠을 벼르다 꺼냈다. 목소리가 떨려서 다 들켰을 거다.', mood: Mood.EXCITEMENT, intensity: 0.8 },
        { text: '그 애가 웃으면서 그러자고 했다. 별것 아닌 대답 하나가 하루 종일 귓가에 맴돌았다.', mood: Mood.JOY, intensity: 0.7 },
      ],
    },
    {
      topic: '알바',
      weight: 1.1,
      fragments: [
        { text: '카페 마감조. 닫기 직전에 들어온 손님이 음료를 잔뜩 시켰다. 웃으며 받았지만 속으로는 한숨이 났다.', mood: Mood.TIRED, intensity: 0.6 },
        { text: '셔터를 내리고 나오니 거리에 아무도 없었다. 내 발소리만 또박또박 따라왔다.', mood: Mood.EMPTINESS, intensity: 0.55 },
      ],
    },
    {
      topic: '진로',
      weight: 1.0,
      fragments: [
        { text: '동기가 인턴에 붙었다고 단톡에 올렸다. 축하한다고 보내놓고 폰을 엎어뒀다. 나만 제자리 같다.', mood: Mood.FEAR, intensity: 0.72 },
        { text: '선배가 자기도 그맘때 매일 무서웠다고 했다. 다들 무서운 채로 그냥 사는 거구나, 조금 놓였다.', mood: Mood.RELIEF, intensity: 0.55 },
      ],
    },
    {
      topic: '밤산책',
      weight: 0.7,
      fragments: [
        { text: '새벽 두 시, 창을 여니 비 냄새가 먼저 들어왔다. 아직 안 오는데 흙이 먼저 젖은 냄새를 냈다.', mood: Mood.CALM, intensity: 0.4 },
        { text: '가로등 밑에 날벌레가 떼로 돌고 있었다. 빛이 좋아 저러는 건지 못 빠져나가는 건지, 한참 봤다.', mood: Mood.NEUTRAL, intensity: 0.35 },
      ],
    },
  ],
  worker: [
    {
      topic: '기획안',
      weight: 1.4,
      fragments: [
        { text: '아침 회의에서 내 기획안이 통째로 엎어졌다. 준비한 며칠이 한순간에 무너지는 기분이었다.', mood: Mood.SAD, intensity: 0.65 },
        { text: '점심도 거르고 다시 자료를 뜯어고쳤다. 화는 가라앉았지만 머리가 묵직했다.', mood: Mood.STRESS, intensity: 0.6 },
        { text: '퇴근길, 팀장이 따로 불러 고생했다고 말해줬다. 인정받은 것 같아 조금은 풀렸다.', mood: Mood.RELIEF, intensity: 0.55 },
      ],
    },
    {
      topic: '마감',
      weight: 1.2,
      fragments: [
        { text: '오래 미뤄둔 프로젝트를 드디어 마감했다. 메일 전송 버튼을 누르고 한참 멍하니 앉아 있었다.', mood: Mood.RELIEF, intensity: 0.7 },
        { text: '동료들과 저녁에 가볍게 맥주 한잔을 했다. 별 얘기 아닌데도 자꾸 웃음이 났다.', mood: Mood.JOY, intensity: 0.6 },
      ],
    },
    {
      topic: '주말출근',
      weight: 1.0,
      fragments: [
        { text: '주말 출근길 텅 빈 사무실이 낯설었다. 혼자라는 게 편하면서도 어딘가 허전했다.', mood: Mood.EMPTINESS, intensity: 0.5 },
        { text: '창가 자리에서 커피를 내려 마시며 밀린 정리를 했다. 느린 오전이 오랜만이라 좋았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
    {
      topic: '야근',
      weight: 1.3,
      fragments: [
        { text: '사무실에 나만 남았다. 자판기 커피를 들고 창밖을 봤다. 맞은편 빌딩에도 불 켜진 칸이 두엇.', mood: Mood.TIRED, intensity: 0.6 },
        { text: '집에 오니 동생이 보낸 조카 걸음마 영상. 열 번쯤 돌려 봤다. 피곤한 게 좀 가셨다.', mood: Mood.LOVE, intensity: 0.5 },
      ],
    },
    {
      topic: '돈',
      weight: 0.9,
      fragments: [
        { text: '전세 만기 통보. 집주인이 올려달란다. 부동산 앱을 한참 들여다봤다. 살 수 있는 동네가 점점 멀어진다.', mood: Mood.STRESS, intensity: 0.55 },
        { text: '매번 잠깐 빌려 사는 기분이다. 박스째 안 푼 짐이 아직도 베란다에 있다.', mood: Mood.EMPTINESS, intensity: 0.5 },
      ],
    },
    {
      topic: '한강',
      weight: 0.7,
      fragments: [
        { text: '오랜만에 한강에 나가 자전거를 빌렸다. 한 바퀴 돌고 벤치에 앉아 한참 강만 봤다.', mood: Mood.CALM, intensity: 0.45 },
        { text: '종아리가 뻐근한 게 오히려 반가웠다. 몸을 쓴 게 며칠 만인지 모르겠다.', mood: Mood.RELIEF, intensity: 0.45 },
      ],
    },
  ],
  homemaker: [
    {
      topic: '아이',
      weight: 1.4,
      fragments: [
        { text: '아이가 학교에서 받아온 상장을 식탁에 슬쩍 올려두고 갔다. 별것 아닌데 종일 흐뭇했다.', mood: Mood.JOY, intensity: 0.75 },
        { text: '저녁 설거지를 하다 문득 세월이 빠르다는 생각이 들었다. 손은 거품 속에 있는데 마음은 멀리 갔다.', mood: Mood.EMPTINESS, intensity: 0.45 },
      ],
    },
    {
      topic: '친구',
      weight: 1.1,
      fragments: [
        { text: '오랜만에 친구에게 전화가 왔다. 안부 몇 마디에 묵은 마음이 따뜻해졌다.', mood: Mood.GRATITUDE, intensity: 0.65 },
        { text: '통화를 끊고 베란다 화분에 물을 줬다. 새로 난 잎을 보니 괜히 기분이 좋아졌다.', mood: Mood.CALM, intensity: 0.55 },
      ],
    },
    {
      topic: '비오는날',
      weight: 1.0,
      fragments: [
        { text: '장을 보고 오는 길에 갑자기 비가 쏟아졌다. 우산도 없이 뛰는데 어이가 없어 웃음이 났다.', mood: Mood.JOY, intensity: 0.6 },
        { text: '집에 와 젖은 머리를 말리며 따뜻한 차를 우렸다. 비 오는 오후의 고요가 나쁘지 않았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
    {
      topic: '무릎',
      weight: 1.0,
      fragments: [
        { text: '계단을 내려갈 때 무릎이 시큰했다. 엄마도 이맘때 무릎 얘길 자주 했는데, 그땐 흘려들었다.', mood: Mood.FEAR, intensity: 0.55 },
        { text: '그래서 엄마가 늘 손잡이를 붙들고 다녔구나. 이제는 내가 그 손잡이를 잡는다.', mood: Mood.SAD, intensity: 0.5 },
      ],
    },
    {
      topic: '남편',
      weight: 0.9,
      fragments: [
        { text: '남편은 뉴스를 보다 그대로 잠들었다. 리모컨을 빼서 끄고 무릎에 얇은 이불을 덮어줬다.', mood: Mood.CALM, intensity: 0.4 },
        { text: '깨우진 않았다. 텔레비전 소리만 메우던 거실이 조용해지니 오히려 마음이 가라앉았다.', mood: Mood.NEUTRAL, intensity: 0.35 },
      ],
    },
    {
      topic: '동창',
      weight: 0.8,
      fragments: [
        { text: '동창 모임에 다녀왔다. 다들 늙었는데 웃을 땐 그대로 열일곱이다.', mood: Mood.JOY, intensity: 0.6 },
        { text: '헤어질 때 영숙이가 무릎에 좋다는 약을 손에 쥐여줬다. 이런 걸 주고받는 나이가 됐네 싶었다.', mood: Mood.GRATITUDE, intensity: 0.55 },
      ],
    },
  ],
}

// 세션 동안 페르소나별로 다음 프리셋을 가리키는 회전 커서 — 같은 일기만 반복해 태어나지 않게 한다.
const rotation: Record<DemoPersona, number> = { student: 0, worker: 0, homemaker: 0 }
// 작성 폼이 연(또는 "별 나누기"가 펼칠) 현재 프리셋 — beginDemoCompose가 고르고, segment/submit이 읽는다.
let active: DiaryPreset | null = null

/** 다음 프리셋 일기를 골라 active로 세운다(페르소나별 회전). 자유모드 "새 별 띄우기"가 열 때 호출. */
export function pickDiaryPreset(persona: DemoPersona): DiaryPreset {
  const pool = DIARY_PRESETS[persona]
  const preset = pool[rotation[persona] % pool.length]
  rotation[persona] = (rotation[persona] + 1) % pool.length
  active = preset
  return preset
}

/** genesis(change 28)가 그 날 쓸 일기를 페르소나 weight 분포대로 한 편 뽑는다 — 난수는 rng가 쥐고
 *  (세션마다 다름, 데모마다 다른 우주), 같은 풀을 자유모드 작성과 공유한다. active는 건드리지 않는다
 *  (작성 폼 흐름과 무관 — genesis는 곧장 별을 빚는다). */
export function pickGenesisDiary(persona: DemoPersona, rng: () => number): DiaryPreset {
  const pool = DIARY_PRESETS[persona]
  const total = pool.reduce((s, p) => s + p.weight, 0)
  let r = rng() * total
  for (const preset of pool) {
    r -= preset.weight
    if (r < 0) return preset
  }
  return pool[pool.length - 1] // 부동소수 잔차 폴백
}

/** 현재 작성 중인 프리셋(없으면 null) — "별 나누기" 분절·제출이 읽는다. */
export function activeDiaryPreset(): DiaryPreset | null {
  return active
}

/** 작성 폼이 닫히거나 제출되면 active를 비운다(다음 작성이 새로 고르게). */
export function clearActiveDiaryPreset(): void {
  active = null
}
