// 데모 "새 별 띄우기" 프리셋 일기 코퍼스(change 25) — 자유모드에서 production 작성 폼을 read-only로
// 재사용할 때 본문에 채워지는 *읽기전용 일기*와, "별 나누기"가 펼칠 *사전분절 조각*이다. 실서버는
// LLM이 본문을 쓰고 사건 경계를 읽지만, 데모엔 네트워크가 없으므로 이 큐레이션 콘텐츠가 그 둘을
// 대체한다 — UI·상태머신·연결/밝기 로직은 production 그대로다(데모 고유는 이 콘텐츠뿐). 페르소나마다
// 결이 다른 몇 편을 두고, 호출마다 다음 편으로 돌려(rotate) 같은 별만 반복해 태어나지 않게 한다.
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

/** 프리셋 일기 한 편 — read-only 본문 + 그 일기의 사전분절 조각들. body는 fragments를 빈 줄로 이은
 *  것과 같다(production이 본문을 조각으로 나누는 것과 같은 모양 — 데모는 그 역을 미리 적어 둔다). */
export interface DiaryPreset {
  fragments: PresetFragment[]
}

const joinBody = (frs: PresetFragment[]): string => frs.map((f) => f.text).join('\n\n')

/** 프리셋 일기의 본문(읽기전용 폼에 채워지는 텍스트). */
export function presetBody(p: DiaryPreset): string {
  return joinBody(p.fragments)
}

// 페르소나별 프리셋 일기 — 하루 안에서 감정이 갈리는 다조각 일기로, "별 나누기"가 조각마다 색이
// 다른 별로 fan-out하는 걸 보인다(production 조각화 체험의 거울).
const DIARY_PRESETS: Record<DemoPersona, DiaryPreset[]> = {
  student: [
    {
      fragments: [
        { text: '발표 차례가 다가올수록 손끝이 차가워졌다. 슬라이드를 몇 번이나 다시 넘겼는지 모른다.', mood: Mood.FEAR, intensity: 0.7 },
        { text: '막상 입을 떼니 목소리가 떨리지 않았다. 끝나고 자리에 앉을 때 다리에 힘이 풀렸다.', mood: Mood.RELIEF, intensity: 0.6 },
        { text: '강의실을 나와 친구가 잘했다고 어깨를 두드려줬다. 그 한마디에 하루의 긴장이 다 녹았다.', mood: Mood.JOY, intensity: 0.65 },
      ],
    },
    {
      fragments: [
        { text: '도서관에서 종일 같은 페이지만 붙잡고 있었다. 글자가 눈에 들어오지 않아 답답했다.', mood: Mood.STRESS, intensity: 0.6 },
        { text: '바람 쐬러 나온 옥상에서 노을을 한참 봤다. 별것 아닌데 마음이 조금 가라앉았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
    {
      fragments: [
        { text: '오랜만에 본가에 내려가 엄마가 끓여준 된장찌개를 먹었다. 익숙한 냄새에 괜히 코끝이 시큰했다.', mood: Mood.LOVE, intensity: 0.75 },
        { text: '올라오는 기차에서 창밖을 보며 다음 학기를 떠올렸다. 잘 해내고 싶다는 마음이 조용히 들었다.', mood: Mood.CALM, intensity: 0.55 },
      ],
    },
  ],
  worker: [
    {
      fragments: [
        { text: '아침 회의에서 내 기획안이 통째로 엎어졌다. 준비한 며칠이 한순간에 무너지는 기분이었다.', mood: Mood.SAD, intensity: 0.65 },
        { text: '점심도 거르고 다시 자료를 뜯어고쳤다. 화는 가라앉았지만 머리가 묵직했다.', mood: Mood.STRESS, intensity: 0.6 },
        { text: '퇴근길, 팀장이 따로 불러 고생했다고 말해줬다. 인정받은 것 같아 조금은 풀렸다.', mood: Mood.RELIEF, intensity: 0.55 },
      ],
    },
    {
      fragments: [
        { text: '오래 미뤄둔 프로젝트를 드디어 마감했다. 메일 전송 버튼을 누르고 한참 멍하니 앉아 있었다.', mood: Mood.RELIEF, intensity: 0.7 },
        { text: '동료들과 저녁에 가볍게 맥주 한잔을 했다. 별 얘기 아닌데도 자꾸 웃음이 났다.', mood: Mood.JOY, intensity: 0.6 },
      ],
    },
    {
      fragments: [
        { text: '주말 출근길 텅 빈 사무실이 낯설었다. 혼자라는 게 편하면서도 어딘가 허전했다.', mood: Mood.EMPTINESS, intensity: 0.5 },
        { text: '창가 자리에서 커피를 내려 마시며 밀린 정리를 했다. 느린 오전이 오랜만이라 좋았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
  ],
  homemaker: [
    {
      fragments: [
        { text: '아이가 학교에서 받아온 상장을 식탁에 슬쩍 올려두고 갔다. 별것 아닌데 종일 흐뭇했다.', mood: Mood.JOY, intensity: 0.75 },
        { text: '저녁 설거지를 하다 문득 세월이 빠르다는 생각이 들었다. 손은 거품 속에 있는데 마음은 멀리 갔다.', mood: Mood.EMPTINESS, intensity: 0.45 },
      ],
    },
    {
      fragments: [
        { text: '오랜만에 친구에게 전화가 왔다. 안부 몇 마디에 묵은 마음이 따뜻해졌다.', mood: Mood.GRATITUDE, intensity: 0.65 },
        { text: '통화를 끊고 베란다 화분에 물을 줬다. 새로 난 잎을 보니 괜히 기분이 좋아졌다.', mood: Mood.CALM, intensity: 0.55 },
      ],
    },
    {
      fragments: [
        { text: '장을 보고 오는 길에 갑자기 비가 쏟아졌다. 우산도 없이 뛰는데 어이가 없어 웃음이 났다.', mood: Mood.JOY, intensity: 0.6 },
        { text: '집에 와 젖은 머리를 말리며 따뜻한 차를 우렸다. 비 오는 오후의 고요가 나쁘지 않았다.', mood: Mood.CALM, intensity: 0.5 },
      ],
    },
  ],
}

// 세션 동안 페르소나별로 다음 프리셋을 가리키는 회전 커서 — 같은 일기만 반복해 태어나지 않게 한다.
const rotation: Record<DemoPersona, number> = { student: 0, worker: 0, homemaker: 0 }
// 작성 폼이 연(또는 "별 나누기"가 펼칠) 현재 프리셋 — beginDemoCompose가 고르고, segment/submit이 읽는다.
let active: DiaryPreset | null = null

/** 다음 프리셋 일기를 골라 active로 세운다(페르소나별 회전). 작성 폼을 열 때 호출. */
export function pickDiaryPreset(persona: DemoPersona): DiaryPreset {
  const pool = DIARY_PRESETS[persona]
  const preset = pool[rotation[persona] % pool.length]
  rotation[persona] = (rotation[persona] + 1) % pool.length
  active = preset
  return preset
}

/** 현재 작성 중인 프리셋(없으면 null) — "별 나누기" 분절·제출이 읽는다. */
export function activeDiaryPreset(): DiaryPreset | null {
  return active
}

/** 작성 폼이 닫히거나 제출되면 active를 비운다(다음 작성이 새로 고르게). */
export function clearActiveDiaryPreset(): void {
  active = null
}
