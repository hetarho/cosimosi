import type { DemoDiarySet } from '../diary-set.ts'
import { DEMO_BEAT_IDS } from '../scenario.ts'

// One summer measured from a rooftop. `n-rooftop` carries every diary, and `n-cat`, `n-deadline`
// and `n-friend` each cross a diary boundary, so the cluster has more than one reason to pull in.
export const ROOFTOP_SUMMER_SET: DemoDiarySet = {
  structure: {
    id: 'rooftop-summer',
    neurons: [
      { id: 'n-cat', neuronType: 'entity' },
      { id: 'n-deadline', neuronType: 'semantic' },
      { id: 'n-friend', neuronType: 'entity' },
      { id: 'n-rain', neuronType: 'semantic' },
      { id: 'n-rooftop', neuronType: 'spatial' },
    ],
    diaries: [
      {
        id: 'd-rooftop-1',
        dayOffset: 0,
        memories: [
          {
            id: 'm-last-night-of-it',
            mood: 'STRESS',
            intensity: 0.86,
            seed: 40_009n,
            activations: [
              { neuronId: 'n-deadline', weight: 0.94 },
              { neuronId: 'n-rooftop', weight: 0.61 },
            ],
          },
          {
            id: 'm-cat-on-the-ledge',
            mood: 'JOY',
            intensity: 0.74,
            seed: 40_013n,
            activations: [
              { neuronId: 'n-cat', weight: 0.89 },
              { neuronId: 'n-rooftop', weight: 0.72 },
            ],
          },
        ],
      },
      {
        id: 'd-rooftop-2',
        dayOffset: 47,
        memories: [
          {
            id: 'm-someone-brought-melon',
            mood: 'EXCITEMENT',
            intensity: 0.81,
            seed: 50_021n,
            activations: [
              { neuronId: 'n-friend', weight: 0.9 },
              { neuronId: 'n-rooftop', weight: 0.68 },
            ],
          },
          {
            id: 'm-two-in-the-morning',
            mood: 'TIRED',
            intensity: 0.66,
            seed: 50_023n,
            activations: [
              { neuronId: 'n-deadline', weight: 0.77 },
              { neuronId: 'n-cat', weight: 0.54 },
            ],
          },
        ],
      },
      {
        id: 'd-rooftop-3',
        dayOffset: 110,
        memories: [
          {
            id: 'm-first-rain-after',
            mood: 'CALM',
            intensity: 0.58,
            seed: 60_029n,
            activations: [
              { neuronId: 'n-rain', weight: 0.83 },
              { neuronId: 'n-rooftop', weight: 0.75 },
            ],
          },
          {
            id: 'm-he-stayed-till-it-stopped',
            mood: 'GRATITUDE',
            intensity: 0.7,
            seed: 60_031n,
            activations: [
              { neuronId: 'n-friend', weight: 0.86 },
              { neuronId: 'n-rain', weight: 0.64 },
            ],
          },
        ],
      },
    ],
    synapses: [
      {
        id: 's-rooftop-1',
        neuronAId: 'n-deadline',
        neuronBId: 'n-rooftop',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-rooftop-2',
        neuronAId: 'n-cat',
        neuronBId: 'n-rooftop',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-rooftop-3',
        neuronAId: 'n-friend',
        neuronBId: 'n-rooftop',
        strength: 0.34,
        coActivationCount: 1,
        lastActivatedDayOffset: 47,
      },
      {
        id: 's-rooftop-4',
        neuronAId: 'n-cat',
        neuronBId: 'n-deadline',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 47,
      },
      {
        id: 's-rooftop-5',
        neuronAId: 'n-rain',
        neuronBId: 'n-rooftop',
        strength: 0.35,
        coActivationCount: 1,
        lastActivatedDayOffset: 110,
      },
      {
        id: 's-rooftop-6',
        neuronAId: 'n-friend',
        neuronBId: 'n-rain',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 110,
      },
    ],
    sharedNeuronIds: ['n-cat', 'n-deadline', 'n-friend', 'n-rooftop'],
  },
  scenario: {
    beats: DEMO_BEAT_IDS,
    firstDiaryId: 'd-rooftop-1',
    // CALM, against a set whose weighted blend leans EXCITEMENT.
    recallMemoryId: 'm-first-rain-after',
    gistRiseMemoryId: 'm-cat-on-the-ledge',
    ornamentTastes: [
      { kind: 'BACKGROUND', ornamentId: 'background.iridescence' },
      { kind: 'STAR_SHADER', ornamentId: 'star_shader.orb' },
    ],
  },
  text: {
    en: {
      neuronNames: {
        'n-cat': 'Byeol, the cat',
        'n-deadline': 'The deadline',
        'n-friend': 'Jihun',
        'n-rain': 'Rain',
        'n-rooftop': 'The rooftop',
      },
      diaries: {
        'd-rooftop-1': {
          body: 'The last night of the deadline I gave up on the desk and took the laptop to the rooftop, where the air at least moved. Nothing got finished. Around three the neighbour’s cat came along the ledge the way she does, unhurried, as though the whole building were hers, and sat down where she could watch me fail.',
          memories: {
            'm-last-night-of-it': {
              name: 'The last night of the deadline',
              currentText:
                'I gave up on the desk and took the laptop up to the rooftop, where the air at least moved. Nothing got finished up there either.',
              semanticStages: [
                'I moved the work to the rooftop for the air and still finished nothing.',
                'Working badly on a rooftop, late.',
                'A deadline I did not meet.',
                'Unfinished.',
              ],
              decayStages: [
                'I xxxx up on the desk and took the laptop xxxx to the rooftop, where the air at xxxx moved. Nothing got finished up xxxx either.',
                'I xxxx up on the xxxx and took the laptop xxxx to the xxxx where the xxxx at xxxx moved. Nothing xxxx finished up xxxx either.',
                'I xxxx xxxx on the xxxx and took the xxxx xxxx to the xxxx xxxx the xxxx at xxxx moved. Nothing xxxx xxxx xxxx xxxx either.',
                'I xxxx xxxx on the xxxx xxxx xxxx the xxxx xxxx to xxxx xxxx xxxx xxxx xxxx xxxx xxxx moved. Nothing xxxx xxxx xxxx xxxx either.',
              ],
            },
            'm-cat-on-the-ledge': {
              name: 'Byeol along the ledge',
              currentText:
                'Around three the cat came along the ledge, unhurried, as though the whole building were hers. She sat where she could watch me fail.',
              semanticStages: [
                'The cat walked the ledge at three in the morning and sat down to watch me.',
                'A cat arriving late, entirely at ease.',
                'Company on the rooftop.',
                'Unhurried.',
              ],
              decayStages: [
                'Around xxxx the cat came along the ledge, xxxx as though the whole building were hers. She sat xxxx she xxxx watch me fail.',
                'Around xxxx the xxxx xxxx along the ledge, xxxx as though the xxxx building were hers. She sat xxxx she xxxx xxxx me fail.',
                'Around xxxx the xxxx xxxx xxxx the xxxx xxxx as xxxx the xxxx xxxx were hers. She sat xxxx she xxxx xxxx me fail.',
                'Around xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx the xxxx xxxx xxxx hers. She xxxx xxxx she xxxx xxxx me fail.',
              ],
            },
          },
        },
        'd-rooftop-2': {
          body: 'Jihun came over with a melon he had bought for no reason and we cut it badly on the rooftop with a knife from my kitchen. It was the best hour of that month. Then he left and I went back down and worked until two, the cat asleep on the warm lid of the laptop until I moved her.',
          memories: {
            'm-someone-brought-melon': {
              name: 'Jihun and the melon',
              currentText:
                'Jihun came over with a melon he had bought for no reason and we cut it badly on the rooftop with a knife from my kitchen. It was the best hour of that month.',
              semanticStages: [
                'Jihun brought a melon and we ate it badly cut on the rooftop; the best hour of the month.',
                'An unplanned melon, shared on a rooftop.',
                'The best hour of that month.',
                'Brought for no reason.',
              ],
              decayStages: [
                'Jihun came xxxx with a melon he had bought for xxxx xxxx and we xxxx it badly on the rooftop with a knife xxxx my kitchen. It was the xxxx hour of that month.',
                'Jihun xxxx xxxx with a xxxx he had xxxx for xxxx xxxx and we xxxx it xxxx on the xxxx with a xxxx xxxx my kitchen. It was the xxxx hour of that month.',
                'Jihun xxxx xxxx xxxx a xxxx xxxx xxxx xxxx for xxxx xxxx and we xxxx it xxxx xxxx the xxxx with a xxxx xxxx my kitchen. It xxxx the xxxx xxxx of that month.',
                'Jihun xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx for xxxx xxxx and xxxx xxxx it xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx kitchen. It xxxx the xxxx xxxx xxxx that month.',
              ],
            },
            'm-two-in-the-morning': {
              name: 'Working until two',
              currentText:
                'I went back down and worked until two. The cat slept on the warm lid of the laptop until I moved her, and then she forgave me.',
              semanticStages: [
                'I worked until two with the cat asleep on the laptop lid.',
                'Late work, a cat in the way.',
                'Two in the morning.',
                'Forgiven.',
              ],
              decayStages: [
                'I xxxx back down and worked until two. The cat slept on the xxxx xxxx of the laptop until I moved her, and then she xxxx me.',
                'I xxxx back down and xxxx xxxx two. The xxxx xxxx on the xxxx xxxx of the laptop until I moved her, and xxxx she xxxx me.',
                'I xxxx xxxx xxxx and xxxx xxxx two. The xxxx xxxx on the xxxx xxxx of the laptop until I xxxx xxxx and xxxx she xxxx me.',
                'I xxxx xxxx xxxx xxxx xxxx xxxx two. The xxxx xxxx xxxx the xxxx xxxx of xxxx xxxx xxxx I xxxx xxxx xxxx xxxx she xxxx me.',
              ],
            },
          },
        },
        'd-rooftop-3': {
          body: 'The first real rain after the heat came in the evening and everyone on the street started walking faster except us. Jihun stayed on the rooftop under the water tank until it stopped, which took nearly an hour, and we did not talk about anything that had happened that summer.',
          memories: {
            'm-first-rain-after': {
              name: 'The first rain after the heat',
              currentText:
                'The first real rain after the heat came in the evening. Everyone on the street below started walking faster, and up on the rooftop we did not.',
              semanticStages: [
                'The first rain after the heat fell in the evening while we stayed on the rooftop.',
                'Rain arriving after a long heat.',
                'The evening it broke.',
                'Cooler.',
              ],
              decayStages: [
                'The first real xxxx xxxx the heat came in the evening. Everyone on the xxxx below started xxxx faster, and up on the rooftop we did not.',
                'The xxxx real xxxx xxxx the heat xxxx in the evening. Everyone on the xxxx xxxx started xxxx xxxx and up on the xxxx we did not.',
                'The xxxx xxxx xxxx xxxx the heat xxxx in the evening. Everyone on the xxxx xxxx xxxx xxxx xxxx and xxxx on the xxxx we xxxx not.',
                'The xxxx xxxx xxxx xxxx the xxxx xxxx xxxx xxxx evening. Everyone on xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx the xxxx we xxxx not.',
              ],
              reconsolidatedText:
                'What I kept was the sound of everyone below walking faster, and the two of us on the rooftop deciding not to.',
            },
            'm-he-stayed-till-it-stopped': {
              name: 'He stayed until it stopped',
              currentText:
                'Jihun stayed under the water tank until the rain stopped, which took nearly an hour, and we did not talk about anything that had happened that summer.',
              semanticStages: [
                'Jihun waited out an hour of rain with me and we left the summer unmentioned.',
                'Someone stayed through the rain without asking.',
                'He waited it out.',
                'Stayed.',
              ],
              decayStages: [
                'Jihun stayed xxxx the water tank until the xxxx stopped, which took xxxx an hour, and we xxxx not talk xxxx anything that had happened that summer.',
                'Jihun stayed xxxx the xxxx tank xxxx the xxxx xxxx which took xxxx an hour, and we xxxx xxxx talk xxxx anything that xxxx happened that summer.',
                'Jihun xxxx xxxx the xxxx tank xxxx the xxxx xxxx xxxx took xxxx an hour, and we xxxx xxxx xxxx xxxx xxxx that xxxx xxxx that summer.',
                'Jihun xxxx xxxx the xxxx xxxx xxxx the xxxx xxxx xxxx xxxx xxxx xxxx xxxx and xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx that summer.',
              ],
            },
          },
        },
      },
    },
    ko: {
      neuronNames: {
        'n-cat': '고양이 별이',
        'n-deadline': '마감',
        'n-friend': '지훈',
        'n-rain': '비',
        'n-rooftop': '옥상',
      },
      diaries: {
        'd-rooftop-1': {
          body: '마감 마지막 밤에 책상을 포기하고 노트북을 들고 옥상으로 올라갔다. 거기는 적어도 공기가 움직였다. 아무것도 끝내지 못했다. 세 시쯤 옆집 고양이가 늘 그러듯 난간을 따라 걸어왔다. 서두르지 않고, 건물 전체가 자기 것인 것처럼. 그리고 내가 실패하는 걸 볼 수 있는 자리에 앉았다.',
          memories: {
            'm-last-night-of-it': {
              name: '마감의 마지막 밤',
              currentText:
                '책상을 포기하고 노트북을 들고 옥상으로 올라갔다. 거기는 적어도 공기가 움직였다. 위에서도 아무것도 끝내지 못했다.',
              semanticStages: [
                '공기를 찾아 옥상으로 일을 옮겼지만 아무것도 끝내지 못했다.',
                '늦은 밤 옥상에서 일이 되지 않았다.',
                '지키지 못한 마감.',
                '끝내지 못한 것.',
              ],
              decayStages: [
                '책상을 xxxx 노트북을 들고 옥상으로 올라갔다. 거기는 적어도 공기가 움직였다. 위에서도 아무것도 끝내지 못했다.',
                '책상을 xxxx xxxx 들고 옥상으로 올라갔다. 거기는 적어도 공기가 움직였다. 위에서도 아무것도 xxxx 못했다.',
                '책상을 xxxx xxxx 들고 옥상으로 올라갔다. 거기는 적어도 공기가 움직였다. 위에서도 xxxx xxxx 못했다.',
                '책상을 xxxx xxxx 들고 옥상으로 올라갔다. 거기는 xxxx xxxx 움직였다. 위에서도 xxxx xxxx 못했다.',
              ],
            },
            'm-cat-on-the-ledge': {
              name: '난간을 걸어온 별이',
              currentText:
                '세 시쯤 고양이가 난간을 따라 걸어왔다. 서두르지 않고, 건물 전체가 자기 것인 것처럼. 내가 실패하는 걸 볼 수 있는 자리에 앉았다.',
              semanticStages: [
                '새벽 세 시에 고양이가 난간을 걸어와 나를 보려고 앉았다.',
                '늦게 도착해 완전히 편안한 고양이.',
                '옥상의 동행.',
                '서두르지 않고.',
              ],
              decayStages: [
                '세 xxxx xxxx 난간을 따라 걸어왔다. 서두르지 않고, 건물 전체가 자기 것인 것처럼. 내가 실패하는 걸 볼 수 xxxx 자리에 앉았다.',
                '세 xxxx xxxx 난간을 xxxx 걸어왔다. 서두르지 않고, xxxx 전체가 자기 것인 것처럼. 내가 실패하는 xxxx 볼 수 xxxx 자리에 앉았다.',
                '세 xxxx xxxx xxxx xxxx 걸어왔다. 서두르지 않고, xxxx xxxx xxxx 것인 것처럼. 내가 실패하는 xxxx 볼 수 xxxx 자리에 앉았다.',
                '세 xxxx xxxx xxxx xxxx 걸어왔다. 서두르지 않고, xxxx xxxx xxxx xxxx 것처럼. 내가 xxxx xxxx 볼 수 xxxx xxxx 앉았다.',
              ],
            },
          },
        },
        'd-rooftop-2': {
          body: '지훈이 이유 없이 사 온 멜론을 들고 왔고 우리는 부엌에서 가져온 칼로 옥상에서 그것을 엉망으로 잘랐다. 그 달의 가장 좋은 한 시간이었다. 그리고 지훈이 돌아가고 나는 다시 내려와 두 시까지 일했다. 고양이는 내가 옮길 때까지 따뜻한 노트북 뚜껑 위에서 잤다.',
          memories: {
            'm-someone-brought-melon': {
              name: '지훈과 멜론',
              currentText:
                '지훈이 이유 없이 사 온 멜론을 들고 왔고 우리는 부엌에서 가져온 칼로 옥상에서 그것을 엉망으로 잘랐다. 그 달의 가장 좋은 한 시간이었다.',
              semanticStages: [
                '지훈이 멜론을 가져와 옥상에서 엉망으로 잘라 먹었고 그 달 최고의 시간이었다.',
                '예정에 없던 멜론을 옥상에서 나눠 먹었다.',
                '그 달의 가장 좋은 한 시간.',
                '이유 없이 사 온 것.',
              ],
              decayStages: [
                '지훈이 이유 xxxx 사 온 멜론을 들고 왔고 우리는 부엌에서 xxxx 칼로 옥상에서 그것을 xxxx 잘랐다. 그 달의 가장 좋은 한 시간이었다.',
                '지훈이 이유 xxxx xxxx 온 멜론을 xxxx 왔고 우리는 부엌에서 xxxx 칼로 옥상에서 그것을 xxxx 잘랐다. 그 xxxx xxxx 좋은 한 시간이었다.',
                '지훈이 이유 xxxx xxxx xxxx 멜론을 xxxx 왔고 우리는 부엌에서 xxxx xxxx 옥상에서 그것을 xxxx 잘랐다. 그 xxxx xxxx 좋은 xxxx 시간이었다.',
                '지훈이 xxxx xxxx xxxx xxxx xxxx xxxx 왔고 xxxx 부엌에서 xxxx xxxx 옥상에서 xxxx xxxx 잘랐다. 그 xxxx xxxx xxxx xxxx 시간이었다.',
              ],
            },
            'm-two-in-the-morning': {
              name: '두 시까지',
              currentText:
                '다시 내려와 두 시까지 일했다. 고양이는 내가 옮길 때까지 따뜻한 노트북 뚜껑 위에서 잤고, 그다음엔 나를 용서했다.',
              semanticStages: [
                '노트북 뚜껑 위에 고양이를 얹은 채 두 시까지 일했다.',
                '늦은 작업, 방해하는 고양이.',
                '새벽 두 시.',
                '용서받았다.',
              ],
              decayStages: [
                '다시 xxxx 두 시까지 일했다. 고양이는 내가 옮길 때까지 따뜻한 노트북 뚜껑 위에서 잤고, xxxx 나를 용서했다.',
                '다시 xxxx 두 시까지 일했다. 고양이는 내가 옮길 때까지 xxxx 노트북 xxxx 위에서 xxxx xxxx 나를 용서했다.',
                '다시 xxxx 두 시까지 일했다. 고양이는 내가 옮길 xxxx xxxx 노트북 xxxx 위에서 xxxx xxxx xxxx 용서했다.',
                '다시 xxxx 두 xxxx 일했다. 고양이는 내가 xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx 용서했다.',
              ],
            },
          },
        },
        'd-rooftop-3': {
          body: '더위가 지나고 처음 오는 제대로 된 비가 저녁에 내렸고 거리의 모든 사람이 걸음을 빨리했다. 우리만 그러지 않았다. 지훈은 비가 그칠 때까지 물탱크 아래에 있었다. 거의 한 시간이 걸렸고, 우리는 그 여름에 있었던 어떤 일에 대해서도 말하지 않았다.',
          memories: {
            'm-first-rain-after': {
              name: '더위 뒤 첫 비',
              currentText:
                '더위가 지나고 처음 오는 제대로 된 비가 저녁에 내렸다. 아래 거리의 모든 사람이 걸음을 빨리했고, 옥상 위의 우리는 그러지 않았다.',
              semanticStages: [
                '더위 뒤 첫 비가 저녁에 내리는 동안 우리는 옥상에 있었다.',
                '긴 더위 끝에 도착한 비.',
                '더위가 꺾인 저녁.',
                '시원해진 것.',
              ],
              decayStages: [
                '더위가 지나고 처음 오는 제대로 된 비가 저녁에 내렸다. 아래 거리의 xxxx 사람이 걸음을 xxxx 옥상 위의 xxxx 그러지 않았다.',
                '더위가 지나고 처음 xxxx xxxx 된 비가 xxxx 내렸다. 아래 거리의 xxxx 사람이 걸음을 xxxx 옥상 위의 xxxx 그러지 않았다.',
                '더위가 xxxx 처음 xxxx xxxx 된 비가 xxxx 내렸다. 아래 거리의 xxxx 사람이 xxxx xxxx xxxx 위의 xxxx 그러지 않았다.',
                '더위가 xxxx xxxx xxxx xxxx 된 비가 xxxx 내렸다. 아래 xxxx xxxx 사람이 xxxx xxxx xxxx xxxx xxxx xxxx 않았다.',
              ],
              reconsolidatedText:
                '남은 것은 아래에서 모두가 걸음을 빨리하는 소리, 그리고 옥상의 우리 둘이 그러지 않기로 한 순간이었다.',
            },
            'm-he-stayed-till-it-stopped': {
              name: '그칠 때까지 있었다',
              currentText:
                '지훈은 비가 그칠 때까지 물탱크 아래에 있었다. 거의 한 시간이 걸렸고, 우리는 그 여름에 있었던 어떤 일에 대해서도 말하지 않았다.',
              semanticStages: [
                '지훈은 한 시간의 비를 함께 기다렸고 우리는 그 여름을 말하지 않았다.',
                '묻지 않고 비를 함께 기다려준 사람.',
                '그는 기다려주었다.',
                '함께 있었다.',
              ],
              decayStages: [
                '지훈은 비가 그칠 때까지 물탱크 아래에 있었다. 거의 xxxx 시간이 걸렸고, 우리는 xxxx 여름에 있었던 어떤 일에 xxxx 말하지 않았다.',
                '지훈은 비가 xxxx 때까지 xxxx 아래에 있었다. 거의 xxxx 시간이 걸렸고, 우리는 xxxx xxxx 있었던 어떤 일에 xxxx 말하지 않았다.',
                '지훈은 비가 xxxx xxxx xxxx 아래에 있었다. 거의 xxxx xxxx 걸렸고, 우리는 xxxx xxxx 있었던 어떤 xxxx xxxx 말하지 않았다.',
                '지훈은 xxxx xxxx xxxx xxxx xxxx 있었다. 거의 xxxx xxxx xxxx 우리는 xxxx xxxx 있었던 어떤 xxxx xxxx xxxx 않았다.',
              ],
            },
          },
        },
      },
    },
  },
}
