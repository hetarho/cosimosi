import { m, type Locale } from '../../../shared/i18n/index.ts'

import type { WalkthroughContent, WalkthroughStepId } from '../model/walkthrough.ts'

/**
 * The walkthrough's one story, authored in both languages: a written day, its precomputed split,
 * the entries that accumulate after it, and the scene the recall steps return to. Fixture content
 * like the demo's diary sets — never anyone's data, deterministic by construction (the only inputs
 * are the locale and the step), and carrying no coordinate ([I5]): where a memory stands on the
 * canvas is the scene's layout concern, never a stored fact.
 *
 * The proportions are the argument. The week is written mostly quiet (two CALM entries, one
 * STRESS), and the memory the visitor returns to is the LOVE scene — so the mirror step can show
 * the sky leaning towards what is re-read rather than what was merely written down.
 */
const WALKTHROUGH_TEXT: Readonly<Record<Locale, WalkthroughContent>> = {
  ko: {
    diaryText:
      '점심에 새로 온 후배와 처음으로 오래 이야기했다. 생각보다 잘 통해서 좀 놀랐다. 다음엔 같이 커피를 마시기로 했다. 오후 회의는 길게 늘어져서 끝날 즈음엔 다들 말이 없어졌다. 창밖이 어두워지는 걸 다 같이 지켜보기만 했다. 퇴근길에 엄마한테 전화가 왔다. 별 얘기는 아니었는데, 끊고 나니 하루가 조금 부드러워져 있었다.',
    splitScenes: [
      {
        name: '후배와의 첫 대화',
        mood: 'JOY',
        text: '점심에 새로 온 후배와 처음으로 오래 이야기했다. 생각보다 잘 통해서 좀 놀랐다. 다음엔 같이 커피를 마시기로 했다.',
        dayOffset: 0,
        neurons: ['후배', '점심', '회사'],
      },
      {
        name: '끝나지 않던 회의',
        mood: 'TIRED',
        text: '오후 회의는 길게 늘어져서 끝날 즈음엔 다들 말이 없어졌다. 창밖이 어두워지는 걸 다 같이 지켜보기만 했다.',
        dayOffset: 0,
        neurons: ['회의', '회사'],
      },
      {
        name: '퇴근길의 전화',
        mood: 'LOVE',
        text: '퇴근길에 엄마한테 전화가 왔다. 별 얘기는 아니었는데, 끊고 나니 하루가 조금 부드러워져 있었다.',
        dayOffset: 0,
        neurons: ['엄마', '전화', '퇴근길'],
      },
    ],
    laterEntries: [
      {
        name: '늦잠 잔 일요일',
        mood: 'CALM',
        text: '알람 없이 늦게 일어나서 창문을 열어 두고 한참을 그대로 누워 있었다.',
        dayOffset: 2,
      },
      {
        name: '친구가 보낸 사진',
        mood: 'GRATITUDE',
        text: '작년 여행 사진을 친구가 불쑥 보내 줬다. 그때 우리가 웃던 이유가 전부 기억났다.',
        dayOffset: 4,
      },
      {
        name: '밀린 마감',
        mood: 'STRESS',
        text: '미뤄 둔 일이 한꺼번에 몰려서 하루 종일 시계만 보면서 버텼다.',
        dayOffset: 6,
      },
      {
        name: '밤 산책',
        mood: 'CALM',
        text: '잠이 안 와서 나간 산책이 생각보다 길어졌다. 밤공기가 차서 오히려 좋았다.',
        dayOffset: 9,
      },
    ],
    recall: {
      sceneIndex: 2,
      reconsolidatedText:
        '퇴근길에 엄마한테 전화가 왔다. 목소리가 평소보다 반가웠던 것 같기도 하다. 끊고 나니 하루가 한결 부드러워져 있었다.',
    },
  },
  en: {
    diaryText:
      'Had my first long talk with the new junior over lunch. We got along better than I expected, and we said we would grab coffee sometime. The afternoon meeting dragged on until everyone had gone quiet, all of us just watching it get dark outside. On the way home my mom called. It was nothing in particular, but after we hung up the day felt a little softer.',
    splitScenes: [
      {
        name: 'First talk with the new junior',
        mood: 'JOY',
        text: 'Had my first long talk with the new junior over lunch. We got along better than I expected, and we said we would grab coffee sometime.',
        dayOffset: 0,
        neurons: ['junior', 'lunch', 'office'],
      },
      {
        name: 'The meeting that would not end',
        mood: 'TIRED',
        text: 'The afternoon meeting dragged on until everyone had gone quiet, all of us just watching it get dark outside.',
        dayOffset: 0,
        neurons: ['meeting', 'office'],
      },
      {
        name: 'The call on the way home',
        mood: 'LOVE',
        text: 'On the way home my mom called. It was nothing in particular, but after we hung up the day felt a little softer.',
        dayOffset: 0,
        neurons: ['mom', 'phone', 'way home'],
      },
    ],
    laterEntries: [
      {
        name: 'A Sunday slept through',
        mood: 'CALM',
        text: 'Woke up late with no alarm, opened the window, and stayed in bed a while longer.',
        dayOffset: 2,
      },
      {
        name: 'A photo from a friend',
        mood: 'GRATITUDE',
        text: 'A friend sent a photo from last year’s trip out of nowhere. I remembered every reason we were laughing.',
        dayOffset: 4,
      },
      {
        name: 'The backlog',
        mood: 'STRESS',
        text: 'Everything I had put off arrived at once, and I spent the whole day watching the clock.',
        dayOffset: 6,
      },
      {
        name: 'A night walk',
        mood: 'CALM',
        text: 'Could not sleep, went out, and the walk ran longer than I meant it to. The cold air helped.',
        dayOffset: 9,
      },
    ],
    recall: {
      sceneIndex: 2,
      reconsolidatedText:
        'On the way home my mom called. I think her voice was warmer than usual, somehow. After we hung up the day felt much softer.',
    },
  },
}

export function walkthroughContent(locale: Locale): WalkthroughContent {
  return WALKTHROUGH_TEXT[locale]
}

export interface WalkthroughStepCopy {
  readonly prompt: () => string
  readonly action: () => string
  readonly result: () => string
}

/**
 * Each step's words, exhaustive over the step union — a step without copy is a `tsc` failure. The
 * action labels are the product's own verbs where one exists (`writing_flow_split_action`,
 * `writing_flow_launch_action`, the recall register), so the walkthrough and the product read as
 * the same thing. The mirror step's [M5] definition is rendered by the section on top of these.
 */
export const WALKTHROUGH_STEP_COPY: Readonly<Record<WalkthroughStepId, WalkthroughStepCopy>> = {
  split: {
    prompt: m.landing_walk_split_prompt,
    action: m.landing_walk_split_action,
    result: m.landing_walk_split_result,
  },
  launch: {
    prompt: m.landing_walk_launch_prompt,
    action: m.landing_walk_launch_action,
    result: m.landing_walk_launch_result,
  },
  color: {
    prompt: m.landing_walk_color_prompt,
    action: m.landing_walk_color_action,
    result: m.landing_walk_color_result,
  },
  fade: {
    prompt: m.landing_walk_fade_prompt,
    action: m.landing_walk_fade_action,
    result: m.landing_walk_fade_result,
  },
  recall: {
    prompt: m.landing_walk_recall_prompt,
    action: m.landing_walk_recall_action,
    result: m.landing_walk_recall_result,
  },
  mirror: {
    prompt: m.landing_walk_mirror_prompt,
    action: m.landing_walk_mirror_action,
    result: m.landing_walk_mirror_result,
  },
}
