import type { DemoDiarySet } from '../diary-set.ts'
import { DEMO_BEAT_IDS } from '../scenario.ts'

// A move, told from either side of it. Four of the five neurons cross a diary boundary, so the
// cluster tightens as the second and third diaries arrive rather than at the first.
export const MOVING_BOXES_SET: DemoDiarySet = {
  structure: {
    id: 'moving-boxes',
    neurons: [
      { id: 'n-beginning', neuronType: 'semantic' },
      { id: 'n-boxes', neuronType: 'entity' },
      { id: 'n-father', neuronType: 'entity' },
      { id: 'n-old-room', neuronType: 'spatial' },
      { id: 'n-window', neuronType: 'spatial' },
    ],
    diaries: [
      {
        id: 'd-moving-1',
        dayOffset: 0,
        memories: [
          {
            id: 'm-room-without-anything',
            mood: 'EMPTINESS',
            intensity: 0.72,
            seed: 70_001n,
            activations: [
              { neuronId: 'n-old-room', weight: 0.91 },
              { neuronId: 'n-boxes', weight: 0.66 },
            ],
          },
          {
            id: 'm-signing-the-lease',
            mood: 'FEAR',
            intensity: 0.8,
            seed: 70_003n,
            activations: [
              { neuronId: 'n-beginning', weight: 0.87 },
              { neuronId: 'n-boxes', weight: 0.52 },
            ],
          },
        ],
      },
      {
        id: 'd-moving-2',
        dayOffset: 52,
        memories: [
          {
            id: 'm-father-measured-the-wall',
            mood: 'NEUTRAL',
            intensity: 0.5,
            seed: 80_011n,
            activations: [
              { neuronId: 'n-father', weight: 0.84 },
              { neuronId: 'n-old-room', weight: 0.58 },
            ],
          },
          {
            id: 'm-west-light-at-six',
            mood: 'RELIEF',
            intensity: 0.62,
            seed: 80_017n,
            activations: [
              { neuronId: 'n-window', weight: 0.9 },
              { neuronId: 'n-beginning', weight: 0.61 },
            ],
          },
        ],
      },
      {
        id: 'd-moving-3',
        dayOffset: 118,
        memories: [
          {
            id: 'm-last-box-flattened',
            mood: 'JOY',
            intensity: 0.76,
            seed: 90_023n,
            activations: [
              { neuronId: 'n-window', weight: 0.7 },
              { neuronId: 'n-boxes', weight: 0.88 },
            ],
          },
          {
            id: 'm-he-called-it-a-good-room',
            mood: 'LOVE',
            intensity: 0.79,
            seed: 90_031n,
            activations: [
              { neuronId: 'n-father', weight: 0.93 },
              { neuronId: 'n-beginning', weight: 0.67 },
            ],
          },
        ],
      },
    ],
    synapses: [
      {
        id: 's-moving-1',
        neuronAId: 'n-boxes',
        neuronBId: 'n-old-room',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-moving-2',
        neuronAId: 'n-beginning',
        neuronBId: 'n-boxes',
        strength: 0.34,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-moving-3',
        neuronAId: 'n-father',
        neuronBId: 'n-old-room',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 52,
      },
      {
        id: 's-moving-4',
        neuronAId: 'n-beginning',
        neuronBId: 'n-window',
        strength: 0.35,
        coActivationCount: 1,
        lastActivatedDayOffset: 52,
      },
      {
        id: 's-moving-5',
        neuronAId: 'n-boxes',
        neuronBId: 'n-window',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 118,
      },
      {
        id: 's-moving-6',
        neuronAId: 'n-beginning',
        neuronBId: 'n-father',
        strength: 0.36,
        coActivationCount: 1,
        lastActivatedDayOffset: 118,
      },
    ],
    sharedNeuronIds: ['n-beginning', 'n-boxes', 'n-father', 'n-old-room', 'n-window'],
  },
  scenario: {
    beats: DEMO_BEAT_IDS,
    firstDiaryId: 'd-moving-1',
    // NEUTRAL, against a set whose weighted blend leans FEAR.
    recallMemoryId: 'm-father-measured-the-wall',
    gistRiseMemoryId: 'm-he-called-it-a-good-room',
    ornamentTastes: [
      { kind: 'BACKGROUND', ornamentId: 'background.lightfall' },
      { kind: 'STAR_SHADER', ornamentId: 'star_shader.facet' },
    ],
  },
  text: {
    en: {
      neuronNames: {
        'n-beginning': 'A beginning',
        'n-boxes': 'The cardboard boxes',
        'n-father': 'Father',
        'n-old-room': 'The old room',
        'n-window': 'The west window',
      },
      diaries: {
        'd-moving-1': {
          body: 'Six years of things came out of that room in a day and a half, and what was left was smaller than I expected. I stood in it for a while with the boxes stacked in the hallway behind me. In the afternoon I signed a lease for somewhere I had seen exactly once, and my hand was not steady doing it.',
          memories: {
            'm-room-without-anything': {
              name: 'The room without anything in it',
              currentText:
                'Six years of things came out in a day and a half, and what was left was smaller than I expected. I stood in it for a while with the boxes stacked behind me.',
              semanticStages: [
                'Emptied of six years, the room turned out smaller than I expected.',
                'An emptied room, smaller than remembered.',
                'Standing in it, done.',
                'Smaller.',
              ],
              decayStages: [
                'Six years of things came xxxx in a xxxx and a half, and what was left was smaller than I expected. I xxxx in it for a while with the xxxx xxxx xxxx me.',
                'Six years of xxxx came xxxx in a xxxx and a xxxx and xxxx was left was xxxx xxxx I expected. I xxxx in it for a xxxx with the xxxx xxxx xxxx me.',
                'Six xxxx of xxxx xxxx xxxx in xxxx xxxx xxxx a xxxx and xxxx was xxxx xxxx xxxx xxxx I expected. I xxxx in it for a xxxx with the xxxx xxxx xxxx me.',
                'Six xxxx xxxx xxxx xxxx xxxx in xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx expected. I xxxx xxxx it for a xxxx with xxxx xxxx xxxx xxxx me.',
              ],
            },
            'm-signing-the-lease': {
              name: 'Signing for a room I had seen once',
              currentText:
                'In the afternoon I signed a lease for somewhere I had seen exactly once. My hand was not steady doing it, and I signed anyway.',
              semanticStages: [
                'I signed for a place I had seen once, with an unsteady hand, and signed anyway.',
                'Committing to somewhere barely seen.',
                'Signed it anyway.',
                'Decided.',
              ],
              decayStages: [
                'In the afternoon I signed a xxxx for xxxx I xxxx seen xxxx once. My hand was not steady doing it, and I signed anyway.',
                'In the xxxx I xxxx a xxxx for xxxx I xxxx xxxx xxxx once. My hand was not steady xxxx it, and I signed anyway.',
                'In the xxxx I xxxx a xxxx for xxxx I xxxx xxxx xxxx once. My xxxx was xxxx xxxx xxxx it, and I xxxx anyway.',
                'In xxxx xxxx xxxx xxxx a xxxx xxxx xxxx I xxxx xxxx xxxx once. My xxxx was xxxx xxxx xxxx xxxx xxxx I xxxx anyway.',
              ],
            },
          },
        },
        'd-moving-2': {
          body: 'Father came by with a tape measure and spent twenty minutes on the wall by the door, deciding where a shelf could go. He did not say anything about the old room, which was his way of saying something about it. Later the west light came through at six and made the whole floor gold, and I sat down on it because there was no chair yet.',
          memories: {
            'm-father-measured-the-wall': {
              name: 'Father and the tape measure',
              currentText:
                'He spent twenty minutes on the wall by the door, deciding where a shelf could go. He said nothing about the old room, which was his way of saying something about it.',
              semanticStages: [
                'Father measured a wall for a shelf and said nothing about the old room.',
                'A measured wall, and a silence about the old place.',
                'He came and measured.',
                'Said nothing.',
              ],
              decayStages: [
                'He spent twenty minutes on the wall by the door, xxxx where a shelf could go. He said nothing xxxx the xxxx xxxx which was his way of xxxx something about it.',
                'He spent twenty minutes on the xxxx by the xxxx xxxx where a shelf xxxx go. He said nothing xxxx the xxxx xxxx xxxx was xxxx way of xxxx something xxxx it.',
                'He xxxx xxxx minutes on the xxxx by the xxxx xxxx where a xxxx xxxx go. He xxxx xxxx xxxx the xxxx xxxx xxxx was xxxx way of xxxx something xxxx it.',
                'He xxxx xxxx xxxx on the xxxx by xxxx xxxx xxxx xxxx xxxx xxxx xxxx go. He xxxx xxxx xxxx the xxxx xxxx xxxx was xxxx xxxx xxxx xxxx xxxx xxxx it.',
              ],
            },
            'm-west-light-at-six': {
              name: 'The west light at six',
              currentText:
                'The west light came through at six and made the whole floor gold. I sat down on it because there was no chair yet.',
              semanticStages: [
                'At six the west window turned the bare floor gold and I sat on it.',
                'Late light on an empty floor.',
                'Gold at six.',
                'Enough.',
              ],
              decayStages: [
                'The west light came through at xxxx and made the whole floor gold. I xxxx xxxx on it because there was xxxx chair yet.',
                'The west xxxx xxxx xxxx at xxxx and made the whole floor gold. I xxxx xxxx on it because there was xxxx xxxx yet.',
                'The xxxx xxxx xxxx xxxx at xxxx and xxxx the xxxx floor gold. I xxxx xxxx on it xxxx there was xxxx xxxx yet.',
                'The xxxx xxxx xxxx xxxx at xxxx xxxx xxxx the xxxx xxxx gold. I xxxx xxxx xxxx xxxx xxxx xxxx was xxxx xxxx yet.',
              ],
            },
          },
        },
        'd-moving-3': {
          body: 'I flattened the last box today, which took longer than it should have, and then there was nowhere left for the move to be. Father called in the evening and said it was a good room, twice, as if the second time were an argument. The west window did the thing it does at six and I let it.',
          memories: {
            'm-last-box-flattened': {
              name: 'The last box, flattened',
              currentText:
                'I flattened the last box today, which took longer than it should have. After that there was nowhere left for the move to be.',
              semanticStages: [
                'Flattening the last box left the move with nowhere to be.',
                'The last box gone, the move over.',
                'Finished unpacking.',
                'Over.',
              ],
              decayStages: [
                'I flattened the last box xxxx xxxx took xxxx than it should have. After that there was xxxx left for the move to be.',
                'I xxxx the xxxx xxxx xxxx xxxx took xxxx than it should have. After that there was xxxx left for the xxxx to be.',
                'I xxxx the xxxx xxxx xxxx xxxx xxxx xxxx xxxx it xxxx have. After that there was xxxx xxxx for the xxxx to be.',
                'I xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx have. After that xxxx xxxx xxxx xxxx for the xxxx xxxx be.',
              ],
            },
            'm-he-called-it-a-good-room': {
              name: 'He called it a good room, twice',
              currentText:
                'Father called in the evening and said it was a good room, twice, as if the second time were an argument he was winning.',
              semanticStages: [
                'Father called it a good room twice, the second time like an argument he was winning.',
                'A compliment repeated until it counted.',
                'He said it twice.',
                'A good room.',
              ],
              decayStages: [
                'Father called in the evening and xxxx it was a xxxx xxxx twice, as if the xxxx time were an argument he was winning.',
                'Father xxxx in the evening and xxxx it was a xxxx xxxx xxxx as if the xxxx xxxx were an xxxx he was winning.',
                'Father xxxx in the xxxx xxxx xxxx it xxxx a xxxx xxxx xxxx as xxxx the xxxx xxxx were an xxxx xxxx was winning.',
                'Father xxxx in xxxx xxxx xxxx xxxx it xxxx a xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx were xxxx xxxx xxxx xxxx winning.',
              ],
            },
          },
        },
      },
    },
    ko: {
      neuronNames: {
        'n-beginning': '시작',
        'n-boxes': '이삿짐 상자',
        'n-father': '아버지',
        'n-old-room': '옛 방',
        'n-window': '서쪽 창',
      },
      diaries: {
        'd-moving-1': {
          body: '육 년의 물건이 하루 반 만에 그 방에서 나왔고, 남은 것은 생각보다 작았다. 상자들이 복도에 쌓인 채로 나는 한동안 그 안에 서 있었다. 오후에는 딱 한 번 본 집의 계약서에 서명했다. 그때 손이 떨렸다.',
          memories: {
            'm-room-without-anything': {
              name: '아무것도 없는 방',
              currentText:
                '육 년의 물건이 하루 반 만에 나왔고 남은 것은 생각보다 작았다. 상자들을 등 뒤에 쌓아둔 채 한동안 그 안에 서 있었다.',
              semanticStages: [
                '육 년을 비운 방은 생각보다 작았다.',
                '비워진 방, 기억보다 작았다.',
                '다 끝내고 그 안에 서 있었다.',
                '더 작았다.',
              ],
              decayStages: [
                '육 년의 물건이 하루 반 xxxx 나왔고 남은 xxxx xxxx 작았다. 상자들을 등 뒤에 쌓아둔 채 한동안 그 안에 서 있었다.',
                '육 년의 물건이 하루 반 xxxx 나왔고 xxxx xxxx xxxx 작았다. 상자들을 등 뒤에 쌓아둔 채 xxxx 그 xxxx 서 있었다.',
                '육 년의 물건이 xxxx 반 xxxx 나왔고 xxxx xxxx xxxx 작았다. 상자들을 등 xxxx xxxx 채 xxxx 그 xxxx xxxx 있었다.',
                '육 년의 xxxx xxxx 반 xxxx 나왔고 xxxx xxxx xxxx 작았다. 상자들을 xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx 있었다.',
              ],
            },
            'm-signing-the-lease': {
              name: '한 번 본 방에 서명하다',
              currentText:
                '오후에 딱 한 번 본 집의 계약서에 서명했다. 손이 떨렸고, 그래도 서명했다.',
              semanticStages: [
                '한 번밖에 못 본 집에 떨리는 손으로 그래도 서명했다.',
                '거의 보지 못한 곳에 마음을 정했다.',
                '그래도 서명했다.',
                '정했다.',
              ],
              decayStages: [
                '오후에 딱 한 번 본 집의 계약서에 서명했다. 손이 떨렸고, xxxx 서명했다.',
                '오후에 딱 xxxx 번 본 집의 xxxx 서명했다. 손이 떨렸고, xxxx 서명했다.',
                '오후에 xxxx xxxx 번 본 집의 xxxx 서명했다. 손이 떨렸고, xxxx 서명했다.',
                '오후에 xxxx xxxx xxxx xxxx 집의 xxxx 서명했다. 손이 떨렸고, xxxx 서명했다.',
              ],
            },
          },
        },
        'd-moving-2': {
          body: '아버지가 줄자를 들고 와서 문 옆 벽에 이십 분을 썼다. 선반을 어디에 달 수 있을지 정하는 중이었다. 옛 방에 대해서는 아무 말도 하지 않았고, 그게 아버지가 그것에 대해 말하는 방식이었다. 저녁 여섯 시에는 서쪽 빛이 들어와 바닥 전체를 금색으로 만들었고, 아직 의자가 없어서 나는 그 위에 앉았다.',
          memories: {
            'm-father-measured-the-wall': {
              name: '아버지와 줄자',
              currentText:
                '아버지는 문 옆 벽에 이십 분을 쓰며 선반을 어디에 달 수 있을지 정했다. 옛 방에 대해서는 아무 말도 하지 않았고, 그게 그것에 대해 말하는 방식이었다.',
              semanticStages: [
                '아버지는 선반 자리를 재고 옛 방에 대해서는 말하지 않았다.',
                '재어본 벽, 그리고 옛집에 대한 침묵.',
                '와서 재고 갔다.',
                '말하지 않았다.',
              ],
              decayStages: [
                '아버지는 문 옆 벽에 이십 분을 쓰며 선반을 xxxx 달 xxxx 있을지 정했다. 옛 방에 대해서는 아무 말도 하지 않았고, 그게 xxxx xxxx 말하는 방식이었다.',
                '아버지는 문 옆 벽에 이십 분을 xxxx 선반을 xxxx xxxx xxxx 있을지 정했다. 옛 방에 대해서는 xxxx 말도 하지 xxxx 그게 xxxx xxxx 말하는 방식이었다.',
                '아버지는 문 옆 벽에 xxxx 분을 xxxx 선반을 xxxx xxxx xxxx 있을지 정했다. 옛 xxxx 대해서는 xxxx 말도 하지 xxxx xxxx xxxx xxxx xxxx 방식이었다.',
                '아버지는 xxxx xxxx 벽에 xxxx 분을 xxxx xxxx xxxx xxxx xxxx 있을지 정했다. 옛 xxxx 대해서는 xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx 방식이었다.',
              ],
            },
            'm-west-light-at-six': {
              name: '여섯 시의 서쪽 빛',
              currentText:
                '여섯 시에 서쪽 빛이 들어와 바닥 전체를 금색으로 만들었다. 아직 의자가 없어서 그 위에 앉았다.',
              semanticStages: [
                '여섯 시에 서쪽 창이 빈 바닥을 금색으로 만들고 나는 그 위에 앉았다.',
                '빈 바닥에 내린 늦은 빛.',
                '여섯 시의 금색.',
                '그것으로 충분했다.',
              ],
              decayStages: [
                '여섯 시에 서쪽 빛이 들어와 바닥 xxxx 금색으로 만들었다. 아직 의자가 없어서 xxxx 위에 앉았다.',
                '여섯 시에 서쪽 xxxx 들어와 바닥 xxxx xxxx 만들었다. 아직 의자가 없어서 xxxx 위에 앉았다.',
                '여섯 시에 xxxx xxxx 들어와 xxxx xxxx xxxx 만들었다. 아직 의자가 없어서 xxxx 위에 앉았다.',
                '여섯 시에 xxxx xxxx xxxx xxxx xxxx xxxx 만들었다. 아직 xxxx 없어서 xxxx xxxx 앉았다.',
              ],
            },
          },
        },
        'd-moving-3': {
          body: '오늘 마지막 상자를 접었다. 그럴 필요보다 오래 걸렸고, 그 뒤로는 이사가 있을 자리가 어디에도 없었다. 저녁에 아버지가 전화해서 좋은 방이라고 했다. 두 번 말했는데, 두 번째는 마치 이기고 있는 논쟁처럼 들렸다. 서쪽 창은 여섯 시에 늘 하는 그 일을 했고 나는 그냥 두었다.',
          memories: {
            'm-last-box-flattened': {
              name: '접어버린 마지막 상자',
              currentText:
                '오늘 마지막 상자를 접었고 그럴 필요보다 오래 걸렸다. 그 뒤로는 이사가 있을 자리가 어디에도 없었다.',
              semanticStages: [
                '마지막 상자를 접자 이사는 있을 자리를 잃었다.',
                '마지막 상자가 사라지고 이사가 끝났다.',
                '짐을 다 풀었다.',
                '끝났다.',
              ],
              decayStages: [
                '오늘 마지막 상자를 접었고 그럴 필요보다 오래 걸렸다. 그 뒤로는 이사가 있을 xxxx xxxx 없었다.',
                '오늘 마지막 xxxx 접었고 그럴 xxxx 오래 걸렸다. 그 뒤로는 이사가 있을 xxxx xxxx 없었다.',
                '오늘 마지막 xxxx 접었고 그럴 xxxx xxxx 걸렸다. 그 뒤로는 xxxx 있을 xxxx xxxx 없었다.',
                '오늘 xxxx xxxx xxxx xxxx xxxx xxxx 걸렸다. 그 뒤로는 xxxx 있을 xxxx xxxx 없었다.',
              ],
            },
            'm-he-called-it-a-good-room': {
              name: '좋은 방이라고, 두 번',
              currentText:
                '저녁에 아버지가 전화해서 좋은 방이라고 두 번 말했다. 두 번째는 마치 이기고 있는 논쟁처럼 들렸다.',
              semanticStages: [
                '아버지는 좋은 방이라고 두 번 말했고 두 번째는 이기고 있는 논쟁 같았다.',
                '셀 때까지 반복된 칭찬.',
                '두 번 말했다.',
                '좋은 방.',
              ],
              decayStages: [
                '저녁에 아버지가 전화해서 좋은 방이라고 xxxx 번 말했다. 두 번째는 마치 xxxx 있는 논쟁처럼 들렸다.',
                '저녁에 아버지가 전화해서 좋은 방이라고 xxxx xxxx 말했다. 두 번째는 xxxx xxxx 있는 논쟁처럼 들렸다.',
                '저녁에 아버지가 전화해서 xxxx 방이라고 xxxx xxxx 말했다. 두 번째는 xxxx xxxx 있는 xxxx 들렸다.',
                '저녁에 xxxx xxxx xxxx 방이라고 xxxx xxxx 말했다. 두 번째는 xxxx xxxx xxxx xxxx 들렸다.',
              ],
            },
          },
        },
      },
    },
  },
}
