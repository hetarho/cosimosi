import type { DemoDiarySet } from '../diary-set.ts'
import { DEMO_BEAT_IDS } from '../scenario.ts'

// A goodbye that keeps arriving in pieces. `n-mother`, `n-farewell` and `n-winter-sea` are each
// activated from more than one diary — that overlap is what the fourth beat draws.
export const WINTER_SEA_SET: DemoDiarySet = {
  structure: {
    id: 'winter-sea',
    neurons: [
      { id: 'n-farewell', neuronType: 'semantic' },
      { id: 'n-kitchen', neuronType: 'spatial' },
      { id: 'n-mother', neuronType: 'entity' },
      { id: 'n-tangerine', neuronType: 'entity' },
      { id: 'n-winter-sea', neuronType: 'spatial' },
    ],
    diaries: [
      {
        id: 'd-winter-sea-1',
        dayOffset: 0,
        memories: [
          {
            id: 'm-waters-edge',
            mood: 'SAD',
            intensity: 0.78,
            seed: 10_007n,
            activations: [
              { neuronId: 'n-mother', weight: 0.92 },
              { neuronId: 'n-winter-sea', weight: 0.81 },
              { neuronId: 'n-farewell', weight: 0.74 },
            ],
          },
          {
            id: 'm-tangerine-peel',
            mood: 'CALM',
            intensity: 0.52,
            seed: 10_009n,
            activations: [
              { neuronId: 'n-kitchen', weight: 0.68 },
              { neuronId: 'n-tangerine', weight: 0.57 },
            ],
          },
        ],
      },
      {
        id: 'd-winter-sea-2',
        dayOffset: 58,
        memories: [
          {
            id: 'm-blue-bowl',
            mood: 'LOVE',
            intensity: 0.71,
            seed: 20_011n,
            activations: [
              { neuronId: 'n-mother', weight: 0.88 },
              { neuronId: 'n-kitchen', weight: 0.63 },
            ],
          },
          {
            id: 'm-kept-too-long',
            mood: 'GRATITUDE',
            intensity: 0.6,
            seed: 20_013n,
            activations: [
              { neuronId: 'n-tangerine', weight: 0.72 },
              { neuronId: 'n-farewell', weight: 0.49 },
            ],
          },
        ],
      },
      {
        id: 'd-winter-sea-3',
        dayOffset: 121,
        memories: [
          {
            id: 'm-same-grey-water',
            mood: 'RELIEF',
            intensity: 0.55,
            seed: 30_017n,
            activations: [
              { neuronId: 'n-winter-sea', weight: 0.86 },
              { neuronId: 'n-farewell', weight: 0.7 },
            ],
          },
          {
            id: 'm-never-said',
            mood: 'SAD',
            intensity: 0.83,
            seed: 30_019n,
            activations: [
              { neuronId: 'n-mother', weight: 0.79 },
              { neuronId: 'n-farewell', weight: 0.91 },
            ],
          },
        ],
      },
    ],
    synapses: [
      {
        id: 's-winter-sea-1',
        neuronAId: 'n-farewell',
        neuronBId: 'n-mother',
        strength: 0.48,
        coActivationCount: 2,
        lastActivatedDayOffset: 121,
      },
      {
        id: 's-winter-sea-2',
        neuronAId: 'n-farewell',
        neuronBId: 'n-winter-sea',
        strength: 0.46,
        coActivationCount: 2,
        lastActivatedDayOffset: 121,
      },
      {
        id: 's-winter-sea-3',
        neuronAId: 'n-mother',
        neuronBId: 'n-winter-sea',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-winter-sea-4',
        neuronAId: 'n-kitchen',
        neuronBId: 'n-tangerine',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 0,
      },
      {
        id: 's-winter-sea-5',
        neuronAId: 'n-kitchen',
        neuronBId: 'n-mother',
        strength: 0.34,
        coActivationCount: 1,
        lastActivatedDayOffset: 58,
      },
      {
        id: 's-winter-sea-6',
        neuronAId: 'n-farewell',
        neuronBId: 'n-tangerine',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 58,
      },
    ],
    sharedNeuronIds: ['n-farewell', 'n-mother', 'n-winter-sea'],
  },
  scenario: {
    beats: DEMO_BEAT_IDS,
    firstDiaryId: 'd-winter-sea-1',
    // CALM, against a set whose weighted blend leans SAD.
    recallMemoryId: 'm-tangerine-peel',
    gistRiseMemoryId: 'm-blue-bowl',
    ornamentTastes: [
      { kind: 'BACKGROUND', ornamentId: 'background.soft-aurora' },
      { kind: 'STAR_SHADER', ornamentId: 'star_shader.prism' },
    ],
  },
  text: {
    en: {
      neuronNames: {
        'n-farewell': 'Farewell',
        'n-kitchen': 'The kitchen',
        'n-mother': 'Mother',
        'n-tangerine': 'Tangerines',
        'n-winter-sea': 'The winter sea',
      },
      diaries: {
        'd-winter-sea-1': {
          body: 'We drove down to the winter sea because there was nothing else left to do with the day. Mother stood at the edge of the water for a long time and did not speak, and I waited behind her with my hands in my pockets. On the way home the car smelled of tangerines. The kitchen light was still on when we got back, and someone had left the peel drying on the table.',
          memories: {
            'm-waters-edge': {
              name: 'The water’s edge, unspoken',
              currentText:
                'Mother stood at the edge of the winter sea for a long time and said nothing at all. I waited behind her with my hands in my pockets and let the cold do the talking.',
              semanticStages: [
                'Mother stood at the winter sea without speaking, and I waited behind her.',
                'A long silence at the water’s edge, the two of us not speaking.',
                'Standing apart at the winter sea.',
                'Winter, unspoken.',
              ],
              decayStages: [
                'Mother stood at the edge of the winter xxxx for a xxxx time and said nothing at all. I xxxx xxxx her with my hands in my pockets and let the xxxx xxxx the talking.',
                'Mother stood at the edge of the winter xxxx for a xxxx xxxx and xxxx xxxx at all. I xxxx xxxx her with my xxxx in my xxxx and xxxx the xxxx xxxx the talking.',
                'Mother xxxx at the xxxx of the xxxx xxxx xxxx a xxxx xxxx and xxxx xxxx xxxx all. I xxxx xxxx xxxx with my xxxx in my xxxx and xxxx the xxxx xxxx the talking.',
                'Mother xxxx xxxx the xxxx xxxx xxxx xxxx xxxx xxxx a xxxx xxxx and xxxx xxxx xxxx all. I xxxx xxxx xxxx xxxx xxxx xxxx xxxx my xxxx xxxx xxxx the xxxx xxxx xxxx talking.',
              ],
            },
            'm-tangerine-peel': {
              name: 'Tangerine peel on the kitchen table',
              currentText:
                'The kitchen light was still on when we got home. Someone had left tangerine peel drying on the table, curled up like a small animal.',
              semanticStages: [
                'The kitchen light was on and tangerine peel lay drying on the table.',
                'A lit kitchen, peel left out to dry.',
                'The kitchen, still warm.',
                'A light left on.',
              ],
              decayStages: [
                'The kitchen xxxx was still on when we xxxx home. Someone had left xxxx peel drying on the table, curled up xxxx a small animal.',
                'The kitchen xxxx was still on when we xxxx home. Someone had xxxx xxxx peel drying on the table, xxxx xxxx xxxx a xxxx animal.',
                'The xxxx xxxx was xxxx on xxxx we xxxx home. Someone had xxxx xxxx peel drying on the xxxx xxxx xxxx xxxx a xxxx animal.',
                'The xxxx xxxx was xxxx xxxx xxxx we xxxx home. Someone xxxx xxxx xxxx xxxx xxxx on the xxxx xxxx xxxx xxxx xxxx xxxx animal.',
              ],
            },
          },
        },
        'd-winter-sea-2': {
          body: 'Mother called at an odd hour to ask whether I still had the blue bowl, the shallow one she used for rinsing rice. We talked about her kitchen for a while and then about nothing in particular, which took longer. Later I found a tangerine in my coat pocket from the trip, gone hard and very sweet, and I ate it standing at the sink.',
          memories: {
            'm-blue-bowl': {
              name: 'The blue bowl in her kitchen',
              currentText:
                'She called to ask whether I still had the shallow blue bowl she used for rinsing rice. We talked about her kitchen, and then about nothing, which took longer.',
              semanticStages: [
                'She called about the blue bowl and we talked about her kitchen for a long time.',
                'A phone call about a bowl, and a longer one about nothing.',
                'Her kitchen, over the phone.',
                'Kept in the family.',
              ],
              decayStages: [
                'She called to xxxx whether I still had the shallow blue bowl she used for rinsing rice. We xxxx xxxx xxxx xxxx and then about nothing, which took longer.',
                'She xxxx to xxxx xxxx I still had the shallow blue bowl she used for xxxx rice. We xxxx xxxx xxxx xxxx and xxxx about xxxx which took longer.',
                'She xxxx to xxxx xxxx I xxxx had the shallow blue xxxx she xxxx for xxxx rice. We xxxx xxxx xxxx xxxx and xxxx xxxx xxxx xxxx took longer.',
                'She xxxx to xxxx xxxx xxxx xxxx xxxx the xxxx xxxx xxxx she xxxx for xxxx rice. We xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx longer.',
              ],
            },
            'm-kept-too-long': {
              name: 'A tangerine kept too long',
              currentText:
                'I found a tangerine in my coat pocket from the trip, gone hard and very sweet. I ate it standing at the sink without turning the light on.',
              semanticStages: [
                'A tangerine left in a coat pocket had gone hard and sweet, and I ate it at the sink.',
                'Fruit kept too long, eaten in the dark.',
                'Something small, kept.',
                'Sweeter for the waiting.',
              ],
              decayStages: [
                'I found a tangerine in my coat xxxx from the trip, xxxx hard and very sweet. I ate it xxxx at the sink without xxxx the light on.',
                'I xxxx a xxxx in my coat xxxx xxxx the xxxx xxxx hard and xxxx sweet. I ate it xxxx at the sink without xxxx the light on.',
                'I xxxx a xxxx in my xxxx xxxx xxxx the xxxx xxxx xxxx and xxxx sweet. I xxxx it xxxx at the sink xxxx xxxx the xxxx on.',
                'I xxxx xxxx xxxx in xxxx xxxx xxxx xxxx the xxxx xxxx xxxx xxxx xxxx sweet. I xxxx xxxx xxxx at the xxxx xxxx xxxx xxxx xxxx on.',
              ],
            },
          },
        },
        'd-winter-sea-3': {
          body: 'I went back to the same stretch of coast alone, on a bus that stopped everywhere. The water had the same grey patience as before and I was glad of it. Walking back to the road I thought about how a goodbye keeps arriving in pieces, months apart, and how little of it ever gets said out loud.',
          memories: {
            'm-same-grey-water': {
              name: 'The same grey water, alone',
              currentText:
                'I went back to the same stretch of coast alone. The water had the same grey patience as before, and I was glad of it.',
              semanticStages: [
                'Returning alone to the same coast, the water unchanged and patient.',
                'The same grey water, met alone.',
                'Back at the coast.',
                'Unchanged.',
              ],
              decayStages: [
                'I went xxxx to the xxxx stretch of coast alone. The water had the xxxx grey patience as xxxx and I was glad of it.',
                'I went xxxx to the xxxx xxxx of xxxx alone. The water xxxx the xxxx grey xxxx as xxxx and I was glad of it.',
                'I xxxx xxxx to the xxxx xxxx of xxxx alone. The xxxx xxxx the xxxx xxxx xxxx as xxxx and I was xxxx of it.',
                'I xxxx xxxx to the xxxx xxxx xxxx xxxx alone. The xxxx xxxx the xxxx xxxx xxxx as xxxx xxxx xxxx xxxx xxxx xxxx it.',
              ],
            },
            'm-never-said': {
              name: 'What was never said out loud',
              currentText:
                'Walking back to the road I thought about how a goodbye keeps arriving in pieces, months apart, and how little of it ever gets said out loud.',
              semanticStages: [
                'A goodbye that keeps arriving in pieces, months apart, mostly unsaid.',
                'Farewells arriving late and in fragments.',
                'Mostly unsaid.',
                'In pieces.',
              ],
              decayStages: [
                'Walking back to the road I thought xxxx how a goodbye keeps xxxx in pieces, months apart, and how xxxx of it ever xxxx xxxx out loud.',
                'Walking xxxx to the road I thought xxxx how a xxxx keeps xxxx in xxxx months apart, and xxxx xxxx of it xxxx xxxx xxxx out loud.',
                'Walking xxxx to the xxxx I xxxx xxxx how a xxxx xxxx xxxx in xxxx months xxxx and xxxx xxxx of it xxxx xxxx xxxx xxxx loud.',
                'Walking xxxx to the xxxx I xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx it xxxx xxxx xxxx xxxx loud.',
              ],
            },
          },
        },
      },
    },
    ko: {
      neuronNames: {
        'n-farewell': '이별',
        'n-kitchen': '부엌',
        'n-mother': '엄마',
        'n-tangerine': '귤',
        'n-winter-sea': '겨울 바다',
      },
      diaries: {
        'd-winter-sea-1': {
          body: '그 하루를 달리 쓸 방법이 없어서 겨울 바다까지 내려갔다. 엄마는 물가에 오래 서 있었고 아무 말도 하지 않았다. 나는 주머니에 손을 넣고 조금 뒤에서 기다렸다. 돌아오는 차 안에는 귤 냄새가 배어 있었다. 집에 도착했을 때 부엌 불이 아직 켜져 있었고, 누군가 식탁에 귤껍질을 말리려 두었다.',
          memories: {
            'm-waters-edge': {
              name: '말하지 않은 물가',
              currentText:
                '엄마는 겨울 바다 물가에 오래 서 있었고 끝내 아무 말도 하지 않았다. 나는 주머니에 손을 넣고 조금 뒤에서 기다렸다.',
              semanticStages: [
                '엄마는 겨울 바다에서 말이 없었고 나는 뒤에서 기다렸다.',
                '물가의 긴 침묵, 서로 말하지 않은 채.',
                '겨울 바다에 따로 서 있던 두 사람.',
                '말하지 않은 겨울.',
              ],
              decayStages: [
                '엄마는 겨울 xxxx 물가에 오래 서 있었고 끝내 아무 xxxx 하지 않았다. 나는 주머니에 손을 넣고 xxxx 뒤에서 기다렸다.',
                '엄마는 겨울 xxxx 물가에 오래 xxxx 있었고 끝내 xxxx xxxx 하지 않았다. 나는 주머니에 xxxx 넣고 xxxx 뒤에서 기다렸다.',
                '엄마는 겨울 xxxx xxxx 오래 xxxx xxxx 끝내 xxxx xxxx 하지 않았다. 나는 주머니에 xxxx 넣고 xxxx xxxx 기다렸다.',
                '엄마는 겨울 xxxx xxxx xxxx xxxx xxxx 끝내 xxxx xxxx xxxx 않았다. 나는 주머니에 xxxx xxxx xxxx xxxx 기다렸다.',
              ],
            },
            'm-tangerine-peel': {
              name: '식탁 위 귤껍질',
              currentText:
                '집에 왔을 때 부엌 불이 아직 켜져 있었다. 누군가 식탁에 귤껍질을 말리려 두었고, 작은 짐승처럼 오그라들어 있었다.',
              semanticStages: [
                '부엌 불이 켜져 있었고 식탁에는 귤껍질이 말라가고 있었다.',
                '불 켜진 부엌, 널어둔 껍질.',
                '아직 따뜻한 부엌.',
                '켜둔 불 하나.',
              ],
              decayStages: [
                '집에 왔을 때 부엌 불이 아직 켜져 있었다. 누군가 xxxx 귤껍질을 말리려 두었고, xxxx 짐승처럼 오그라들어 있었다.',
                '집에 왔을 xxxx 부엌 불이 xxxx 켜져 있었다. 누군가 xxxx 귤껍질을 말리려 xxxx xxxx 짐승처럼 오그라들어 있었다.',
                '집에 xxxx xxxx 부엌 불이 xxxx 켜져 있었다. 누군가 xxxx xxxx 말리려 xxxx xxxx 짐승처럼 오그라들어 있었다.',
                '집에 xxxx xxxx xxxx xxxx xxxx xxxx 있었다. 누군가 xxxx xxxx xxxx xxxx xxxx 짐승처럼 오그라들어 있었다.',
              ],
            },
          },
        },
        'd-winter-sea-2': {
          body: '엄마가 이상한 시간에 전화해서 파란 그릇이 아직 있는지 물었다. 쌀 씻을 때 쓰던 얕은 그릇이다. 한참 엄마의 부엌 이야기를 하다가, 아무것도 아닌 이야기를 더 오래 했다. 나중에 코트 주머니에서 그때 여행의 귤을 찾았다. 딱딱해지고 아주 달아져 있었고, 나는 싱크대 앞에 서서 그것을 먹었다.',
          memories: {
            'm-blue-bowl': {
              name: '엄마 부엌의 파란 그릇',
              currentText:
                '쌀 씻을 때 쓰던 얕은 파란 그릇이 아직 있는지 엄마가 전화로 물었다. 부엌 이야기를 하다가 아무것도 아닌 이야기를 더 오래 했다.',
              semanticStages: [
                '파란 그릇 이야기로 시작해 엄마의 부엌을 오래 이야기했다.',
                '그릇에 대한 통화, 그리고 더 긴 아무 이야기.',
                '전화 속의 부엌.',
                '집안에 남은 것.',
              ],
              decayStages: [
                '쌀 씻을 때 쓰던 얕은 xxxx 그릇이 아직 있는지 엄마가 전화로 물었다. 부엌 이야기를 하다가 아무것도 아닌 이야기를 xxxx xxxx 했다.',
                '쌀 xxxx 때 xxxx 얕은 xxxx 그릇이 아직 있는지 엄마가 전화로 물었다. 부엌 이야기를 하다가 아무것도 아닌 xxxx xxxx xxxx 했다.',
                '쌀 xxxx 때 xxxx xxxx xxxx xxxx 아직 있는지 엄마가 전화로 물었다. 부엌 xxxx 하다가 xxxx 아닌 xxxx xxxx xxxx 했다.',
                '쌀 xxxx 때 xxxx xxxx xxxx xxxx xxxx 있는지 xxxx 전화로 물었다. 부엌 xxxx xxxx xxxx xxxx xxxx xxxx xxxx 했다.',
              ],
            },
            'm-kept-too-long': {
              name: '너무 오래 둔 귤',
              currentText:
                '코트 주머니에서 그때 여행의 귤을 찾았다. 딱딱해지고 아주 달아져 있었다. 불을 켜지 않고 싱크대 앞에 서서 먹었다.',
              semanticStages: [
                '주머니에 남아 딱딱해진 귤이 아주 달아서, 싱크대 앞에서 먹었다.',
                '너무 오래 둔 과일을 어둠 속에서 먹었다.',
                '작게 남겨둔 것.',
                '기다린 만큼 달았다.',
              ],
              decayStages: [
                '코트 주머니에서 xxxx 여행의 귤을 찾았다. 딱딱해지고 아주 달아져 있었다. 불을 xxxx 않고 싱크대 앞에 서서 먹었다.',
                '코트 주머니에서 xxxx 여행의 귤을 찾았다. 딱딱해지고 xxxx 달아져 있었다. 불을 xxxx 않고 싱크대 xxxx 서서 먹었다.',
                '코트 주머니에서 xxxx 여행의 귤을 찾았다. 딱딱해지고 xxxx xxxx 있었다. 불을 xxxx 않고 싱크대 xxxx xxxx 먹었다.',
                '코트 xxxx xxxx xxxx 귤을 찾았다. 딱딱해지고 xxxx xxxx 있었다. 불을 xxxx 않고 xxxx xxxx xxxx 먹었다.',
              ],
            },
          },
        },
        'd-winter-sea-3': {
          body: '같은 해안으로 혼자 다시 갔다. 어디에서나 멈추는 버스를 탔다. 물은 전과 같은 회색의 인내를 가지고 있었고 나는 그게 반가웠다. 도로로 걸어 나오면서, 작별이 몇 달씩 간격을 두고 조각으로 도착한다는 것을, 그리고 그중 얼마나 적은 부분만 소리 내어 말해지는지를 생각했다.',
          memories: {
            'm-same-grey-water': {
              name: '혼자 만난 같은 회색 물',
              currentText:
                '같은 해안으로 혼자 다시 갔다. 물은 전과 같은 회색의 인내를 가지고 있었고 나는 그게 반가웠다.',
              semanticStages: [
                '혼자 같은 해안으로 돌아갔고 물은 변함없이 참고 있었다.',
                '혼자 만난 같은 회색 물.',
                '다시 그 해안.',
                '변하지 않은 것.',
              ],
              decayStages: [
                '같은 해안으로 xxxx 다시 갔다. 물은 전과 같은 회색의 xxxx 가지고 있었고 나는 그게 반가웠다.',
                '같은 해안으로 xxxx 다시 갔다. 물은 xxxx 같은 회색의 xxxx xxxx 있었고 나는 그게 반가웠다.',
                '같은 xxxx xxxx 다시 갔다. 물은 xxxx 같은 xxxx xxxx xxxx 있었고 나는 그게 반가웠다.',
                '같은 xxxx xxxx 다시 갔다. 물은 xxxx xxxx xxxx xxxx xxxx xxxx 나는 xxxx 반가웠다.',
              ],
            },
            'm-never-said': {
              name: '소리 내어 말하지 않은 것',
              currentText:
                '도로로 걸어 나오면서 작별이 몇 달씩 간격을 두고 조각으로 도착한다는 것을, 그리고 그중 얼마나 적은 부분만 소리 내어 말해지는지를 생각했다.',
              semanticStages: [
                '작별은 몇 달 간격으로 조각처럼 도착하고 대부분 말해지지 않는다.',
                '늦게, 조각으로 오는 작별.',
                '대체로 말해지지 않았다.',
                '조각들로.',
              ],
              decayStages: [
                '도로로 걸어 나오면서 작별이 몇 달씩 간격을 두고 조각으로 xxxx 것을, 그리고 xxxx xxxx 적은 부분만 소리 내어 말해지는지를 생각했다.',
                '도로로 걸어 xxxx 작별이 몇 달씩 간격을 xxxx 조각으로 xxxx 것을, 그리고 xxxx xxxx xxxx 부분만 소리 xxxx 말해지는지를 생각했다.',
                '도로로 xxxx xxxx 작별이 몇 xxxx 간격을 xxxx 조각으로 xxxx 것을, 그리고 xxxx xxxx xxxx 부분만 소리 xxxx xxxx 생각했다.',
                '도로로 xxxx xxxx xxxx xxxx xxxx xxxx xxxx 조각으로 xxxx xxxx 그리고 xxxx xxxx xxxx 부분만 xxxx xxxx xxxx 생각했다.',
              ],
            },
          },
        },
      },
    },
  },
}
