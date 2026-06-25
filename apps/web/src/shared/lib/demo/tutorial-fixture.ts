// 첫 별 튜토리얼 전용 고정 fixture(change 34·job 50) — 데모 튜토리얼은 자유모드 genesis나 랜덤 별을
// 쓰지 않고(A1), 페르소나별로 **고정된** 일기·조각·별 id를 쓴다. 제출하면 늘 같은 별이 같은 id로 태어나
// 카메라가 안정적으로 프레이밍하고 spotlight가 그 별을 가리킬 수 있다(A7). 좌표는 force-sim이 id 시드에서
// 결정론으로 빚으므로(헌법3 — 서버 좌표 영속 없음) 여기선 콘텐츠·id만 고정한다.
//
// 콘텐츠(배열·문장)라 values.yaml 제외 규칙을 따른다(diary-presets와 동일) — 수치 노브가 아니다.
import { Mood } from '@/shared/api'
import type { DemoPersona } from './flag'
import type { PresetFragment } from './diary-presets'

export interface TutorialFixture {
  /** 고정 원본 일기 id(record). 제출 시 createDemoDiary가 이 baseId로 별을 빚는다. */
  recordId: string
  /** 읽기전용 폼에 채워지는 본문(조각을 빈 줄로 이은 것). */
  body: string
  /** 사전분절 조각(production review 입력 {text,mood,intensity}와 동형). */
  fragments: PresetFragment[]
  /** 태어날 별 id들 — createDemoDiary의 id 규약과 일치(다조각 `${recordId}-f${i}`, 단일 `recordId`).
   *  튜토리얼이 memoryIds[0]로 생성 별을 프레이밍/하이라이트한다(A7). */
  memoryIds: string[]
}

// 페르소나별 고정 일기 — 하루 안에서 감정이 갈리는 2조각으로, "별 나누기"가 색이 다른 두 별로 fan-out하는
// 걸 보인다(production 조각화의 거울). diary-presets 콘텐츠와 결이 같되 *고정*이라 매 진입 동일하다.
const FIXTURE_FRAGMENTS: Record<DemoPersona, PresetFragment[]> = {
  student: [
    { text: '오랜만에 일찍 일어나 도서관 창가 자리에 앉았다. 햇살이 책상에 길게 들어와 괜히 마음이 트였다.', mood: Mood.CALM, intensity: 0.55 },
    { text: '미루던 과제를 드디어 끝내고 제출 버튼을 눌렀다. 어깨에 얹혀 있던 게 한순간에 가벼워졌다.', mood: Mood.RELIEF, intensity: 0.7 },
  ],
  worker: [
    { text: '아침 회의에서 오래 준비한 안건이 통과됐다. 자리에 돌아와서야 참았던 숨이 길게 나왔다.', mood: Mood.RELIEF, intensity: 0.7 },
    { text: '점심에 동료가 수고했다며 커피를 사줬다. 별것 아닌데 그 말 한마디가 오래 남았다.', mood: Mood.GRATITUDE, intensity: 0.6 },
  ],
  homemaker: [
    { text: '아이가 학교에서 받아온 그림을 식탁에 슬쩍 올려두고 갔다. 별것 아닌데 종일 흐뭇했다.', mood: Mood.JOY, intensity: 0.7 },
    { text: '저녁 설거지를 하며 라디오를 틀어두었다. 익숙한 노래에 마음이 잔잔히 가라앉았다.', mood: Mood.CALM, intensity: 0.5 },
  ],
}

const joinBody = (frs: PresetFragment[]): string => frs.map((f) => f.text).join('\n\n')

/** 그 페르소나의 고정 튜토리얼 fixture를 만든다 — recordId/memoryIds는 createDemoDiary의 id 규약과 일치한다
 *  (다조각이면 `${recordId}-f${i}`). 같은 페르소나면 늘 같은 값(고정). */
export function tutorialFixture(persona: DemoPersona): TutorialFixture {
  const fragments = FIXTURE_FRAGMENTS[persona]
  const recordId = `demo-tutorial-${persona}`
  const multi = fragments.length > 1
  const memoryIds = multi ? fragments.map((_, i) => `${recordId}-f${i}`) : [recordId]
  return { recordId, body: joinBody(fragments), fragments, memoryIds }
}
