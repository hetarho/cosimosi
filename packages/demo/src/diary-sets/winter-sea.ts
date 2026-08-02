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
    extraDiaries: [
      {
        id: 'd-winter-sea-4',
        dayOffset: 135,
        memories: [
          {
            id: 'm-shelf-of-jars',
            mood: 'CALM',
            intensity: 0.57,
            seed: 11_003n,
            activations: [
              { neuronId: 'n-kitchen', weight: 0.82 },
              { neuronId: 'n-mother', weight: 0.74 },
            ],
          },
          {
            id: 'm-tangerines-by-post',
            mood: 'LOVE',
            intensity: 0.68,
            seed: 11_005n,
            activations: [
              { neuronId: 'n-tangerine', weight: 0.85 },
              { neuronId: 'n-mother', weight: 0.6 },
            ],
          },
        ],
      },
      {
        id: 'd-winter-sea-5',
        dayOffset: 152,
        memories: [
          {
            id: 'm-goodbye-to-the-kitchen',
            mood: 'SAD',
            intensity: 0.74,
            seed: 12_007n,
            activations: [
              { neuronId: 'n-farewell', weight: 0.8 },
              { neuronId: 'n-kitchen', weight: 0.77 },
            ],
          },
          {
            id: 'm-tangerine-on-the-wall',
            mood: 'RELIEF',
            intensity: 0.6,
            seed: 12_011n,
            activations: [
              { neuronId: 'n-tangerine', weight: 0.7 },
              { neuronId: 'n-winter-sea', weight: 0.82 },
            ],
          },
        ],
      },
      {
        id: 'd-winter-sea-6',
        dayOffset: 170,
        memories: [
          {
            id: 'm-kitchen-the-size-of-a-boats',
            mood: 'CALM',
            intensity: 0.55,
            seed: 13_013n,
            activations: [
              { neuronId: 'n-kitchen', weight: 0.75 },
              { neuronId: 'n-winter-sea', weight: 0.68 },
            ],
          },
          {
            id: 'm-light-left-on',
            mood: 'LOVE',
            intensity: 0.66,
            seed: 13_017n,
            activations: [
              { neuronId: 'n-mother', weight: 0.78 },
              { neuronId: 'n-farewell', weight: 0.52 },
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
      {
        id: 's-winter-sea-7',
        neuronAId: 'n-mother',
        neuronBId: 'n-tangerine',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 135,
      },
      {
        id: 's-winter-sea-8',
        neuronAId: 'n-farewell',
        neuronBId: 'n-kitchen',
        strength: 0.34,
        coActivationCount: 1,
        lastActivatedDayOffset: 152,
      },
      {
        id: 's-winter-sea-9',
        neuronAId: 'n-tangerine',
        neuronBId: 'n-winter-sea',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 152,
      },
      {
        id: 's-winter-sea-10',
        neuronAId: 'n-kitchen',
        neuronBId: 'n-winter-sea',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 170,
      },
    ],
    sharedNeuronIds: ['n-farewell', 'n-mother', 'n-winter-sea'],
  },
  scenario: {
    beats: DEMO_BEAT_IDS,
    firstDiaryId: 'd-winter-sea-1',
    // CALM, against on-screen memories whose weighted blend leans LOVE and SAD.
    recallMemoryId: 'm-tangerine-peel',
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
              reconsolidatedText:
                'It was the peel I remembered, not the light — left on the table to dry, curled up like a small animal, in a kitchen warm enough to bother.',
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
        'd-winter-sea-4': {
          body: 'Mother is leaving the house with the kitchen, so I went over to help her pack it. Most of it she gave away without hesitating, and then she stood a long time over a shelf of jars she had filled and never opened. While we worked a box of tangerines arrived by post from the island, the way one does every winter, and she sent half of it home with me.',
          memories: {
            'm-shelf-of-jars': {
              name: 'The shelf of jars she never opened',
              currentText:
                'She gave most of the kitchen away without hesitating. Then she stood a long time over a shelf of jars she had filled and never opened.',
              semanticStages: [
                'She packed the kitchen quickly except for a shelf of jars she had never opened.',
                'A kitchen given away, one shelf that was hard.',
                'The jars were the hard part.',
                'Kept unopened.',
              ],
              decayStages: [
                'She gave most of the xxxx away without hesitating. Then she stood a long time xxxx a xxxx of jars she had filled and xxxx opened.',
                'She xxxx xxxx of the xxxx away without hesitating. Then she stood a xxxx time xxxx a xxxx of xxxx she had filled and xxxx opened.',
                'She xxxx xxxx of the xxxx away xxxx hesitating. Then she xxxx a xxxx xxxx xxxx a xxxx of xxxx she xxxx xxxx and xxxx opened.',
                'She xxxx xxxx of xxxx xxxx xxxx xxxx hesitating. Then she xxxx xxxx xxxx xxxx xxxx xxxx xxxx of xxxx xxxx xxxx xxxx and xxxx opened.',
              ],
            },
            'm-tangerines-by-post': {
              name: 'Tangerines by post, as every winter',
              currentText:
                'A box of tangerines arrived by post while we packed, the way one does every winter. She sent half of it home with me without asking.',
              semanticStages: [
                'Tangerines arrived by post mid-packing and she gave me half the box.',
                'The winter box, divided without a word.',
                'Half sent home with me.',
                'As every winter.',
              ],
              decayStages: [
                'A box of tangerines arrived by xxxx while we xxxx the way one does every winter. She xxxx half of it home with me xxxx asking.',
                'A box of xxxx arrived by xxxx while we xxxx the xxxx xxxx xxxx every winter. She xxxx half of it home with me xxxx asking.',
                'A xxxx of xxxx arrived by xxxx xxxx we xxxx the xxxx xxxx xxxx xxxx winter. She xxxx xxxx of it xxxx with me xxxx asking.',
                'A xxxx xxxx xxxx xxxx by xxxx xxxx we xxxx the xxxx xxxx xxxx xxxx winter. She xxxx xxxx xxxx it xxxx xxxx xxxx xxxx asking.',
              ],
            },
          },
        },
        'd-winter-sea-5': {
          body: 'We closed up the house today. Mother said goodbye to the kitchen with the light off, quietly, and I pretended to be busy in the hallway so she could have it to herself. Afterwards we drove out to the sea because it was on the way, which it was not, and ate a tangerine each on the wall above the water without talking much.',
          memories: {
            'm-goodbye-to-the-kitchen': {
              name: 'A goodbye said with the light off',
              currentText:
                'Mother said goodbye to the kitchen with the light off, quietly. I pretended to be busy in the hallway so she could have it to herself.',
              semanticStages: [
                'Mother took her leave of the kitchen alone while I waited in the hallway.',
                'A quiet goodbye to a room.',
                'She had it to herself.',
                'With the light off.',
              ],
              decayStages: [
                'Mother said goodbye to the xxxx with the xxxx off, quietly. I pretended to be xxxx in the hallway so she could xxxx it to herself.',
                'Mother xxxx xxxx to the xxxx with the xxxx xxxx quietly. I xxxx to be xxxx in the hallway so she could xxxx it to herself.',
                'Mother xxxx xxxx xxxx the xxxx with xxxx xxxx xxxx quietly. I xxxx to be xxxx in the xxxx so she xxxx xxxx it xxxx herself.',
                'Mother xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx quietly. I xxxx xxxx be xxxx xxxx the xxxx so xxxx xxxx xxxx it xxxx herself.',
              ],
            },
            'm-tangerine-on-the-wall': {
              name: 'A tangerine on the sea wall',
              currentText:
                'We drove out to the sea because it was on the way, which it was not. We ate a tangerine each on the wall above the water, not talking much.',
              semanticStages: [
                'We detoured to the sea and ate tangerines on the wall, mostly quiet.',
                'A detour that was not one, fruit above the water.',
                'Tangerines by the sea.',
                'On the way.',
              ],
              decayStages: [
                'We xxxx out to the xxxx xxxx it was on the xxxx which it was not. We xxxx a tangerine each on the wall above the water, not talking much.',
                'We xxxx out to the xxxx xxxx it was on the xxxx which it was not. We xxxx a xxxx xxxx on the xxxx xxxx the xxxx not talking much.',
                'We xxxx xxxx to the xxxx xxxx it was on xxxx xxxx xxxx it was not. We xxxx a xxxx xxxx on the xxxx xxxx the xxxx xxxx xxxx much.',
                'We xxxx xxxx xxxx the xxxx xxxx xxxx xxxx on xxxx xxxx xxxx it xxxx not. We xxxx a xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx much.',
              ],
            },
          },
        },
        'd-winter-sea-6': {
          body: 'Mother called from the new place while I was washing up, and for once the call was about nothing at all. Her kitchen is the size of a boat’s now and she says the sea is close enough to hear on quiet nights, which I chose to believe. The light over my own sink was on the whole call, and I left it on a while after.',
          memories: {
            'm-kitchen-the-size-of-a-boats': {
              name: 'A kitchen the size of a boat’s',
              currentText:
                'Her kitchen is the size of a boat’s now. She says the sea is close enough to hear on quiet nights, and I chose to believe her.',
              semanticStages: [
                'Her new kitchen is tiny and she claims the sea is within earshot.',
                'A small kitchen near the water.',
                'The sea within earshot.',
                'Close enough.',
              ],
              decayStages: [
                'Her xxxx is the xxxx of a boat’s now. She says the sea is xxxx enough to xxxx on quiet nights, and I chose to believe her.',
                'Her xxxx is the xxxx of a xxxx now. She xxxx the xxxx is xxxx enough to xxxx on quiet xxxx and I chose to xxxx her.',
                'Her xxxx is the xxxx of a xxxx now. She xxxx xxxx xxxx is xxxx xxxx to xxxx on xxxx xxxx and I xxxx to xxxx her.',
                'Her xxxx is xxxx xxxx of xxxx xxxx now. She xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx on xxxx xxxx xxxx xxxx xxxx to xxxx her.',
              ],
            },
            'm-light-left-on': {
              name: 'The light I left on after',
              currentText:
                'The light over my own sink was on for the whole call about nothing. I left it on a while after she hung up.',
              semanticStages: [
                'We talked about nothing while my sink light burned, and I left it on after.',
                'A call about nothing, a light kept on.',
                'Left on a while after.',
                'Still on.',
              ],
              decayStages: [
                'The light over my own sink was on for the xxxx call about nothing. I left it on a xxxx xxxx she xxxx up.',
                'The xxxx over my xxxx sink was on for the xxxx call xxxx nothing. I xxxx it on a xxxx xxxx she xxxx up.',
                'The xxxx xxxx my xxxx xxxx was on for the xxxx xxxx xxxx nothing. I xxxx xxxx on a xxxx xxxx she xxxx up.',
                'The xxxx xxxx my xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx nothing. I xxxx xxxx on xxxx xxxx xxxx she xxxx up.',
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
              reconsolidatedText:
                '기억에 남은 건 불이 아니라 껍질이었다. 작은 짐승처럼 오그라든 채 식탁에서 말라가고 있었고, 부엌은 그럴 만큼 따뜻했다.',
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
        'd-winter-sea-4': {
          body: '엄마가 부엌이 딸린 그 집에서 나오게 되어 짐 싸는 것을 도우러 갔다. 살림 대부분은 망설임 없이 내주었는데, 채워두고 한 번도 열지 않은 병들이 놓인 선반 앞에서는 오래 서 있었다. 일하는 사이에 섬에서 귤 한 상자가 택배로 왔다. 해마다 겨울이면 오는 상자다. 엄마는 절반을 내 손에 들려 보냈다.',
          memories: {
            'm-shelf-of-jars': {
              name: '한 번도 열지 않은 병들',
              currentText:
                '엄마는 부엌 살림 대부분을 망설임 없이 내주었다. 그러고는 채워두고 한 번도 열지 않은 병들이 놓인 선반 앞에 오래 서 있었다.',
              semanticStages: [
                '엄마는 부엌을 금방 정리했지만 열지 않은 병들 앞에서는 오래 멈췄다.',
                '내준 부엌, 어려웠던 선반 하나.',
                '병들이 가장 어려웠다.',
                '열지 않은 채 간직한 것.',
              ],
              decayStages: [
                '엄마는 부엌 살림 대부분을 xxxx 없이 내주었다. 그러고는 채워두고 xxxx 번도 열지 않은 병들이 놓인 xxxx 앞에 오래 서 있었다.',
                '엄마는 부엌 살림 대부분을 xxxx xxxx 내주었다. 그러고는 채워두고 xxxx 번도 열지 않은 xxxx 놓인 xxxx 앞에 xxxx 서 있었다.',
                '엄마는 xxxx xxxx 대부분을 xxxx xxxx 내주었다. 그러고는 채워두고 xxxx 번도 열지 xxxx xxxx 놓인 xxxx 앞에 xxxx 서 있었다.',
                '엄마는 xxxx xxxx xxxx xxxx xxxx 내주었다. 그러고는 채워두고 xxxx 번도 열지 xxxx xxxx xxxx xxxx xxxx xxxx xxxx 있었다.',
              ],
            },
            'm-tangerines-by-post': {
              name: '해마다 오는 귤 상자',
              currentText:
                '짐을 싸는 사이에 귤 한 상자가 택배로 왔다. 해마다 겨울이면 오는 그 상자다. 엄마는 묻지도 않고 절반을 내 손에 들려 보냈다.',
              semanticStages: [
                '짐을 싸다가 도착한 귤 상자의 절반을 엄마가 들려 보냈다.',
                '겨울마다 오는 상자, 말없이 나뉜 절반.',
                '절반은 내 몫이 되었다.',
                '해마다 그랬듯이.',
              ],
              decayStages: [
                '짐을 싸는 사이에 귤 한 상자가 xxxx 왔다. 해마다 xxxx 오는 그 상자다. 엄마는 묻지도 xxxx 절반을 내 손에 들려 보냈다.',
                '짐을 싸는 사이에 귤 한 상자가 xxxx 왔다. 해마다 xxxx 오는 xxxx 상자다. 엄마는 묻지도 xxxx xxxx xxxx 손에 들려 보냈다.',
                '짐을 싸는 xxxx xxxx 한 상자가 xxxx 왔다. 해마다 xxxx 오는 xxxx 상자다. 엄마는 묻지도 xxxx xxxx xxxx xxxx 들려 보냈다.',
                '짐을 xxxx xxxx xxxx 한 상자가 xxxx 왔다. 해마다 xxxx 오는 xxxx 상자다. 엄마는 xxxx xxxx xxxx xxxx xxxx xxxx 보냈다.',
              ],
            },
          },
        },
        'd-winter-sea-5': {
          body: '오늘 그 집을 다 비웠다. 엄마는 불을 끈 부엌에 대고 조용히 작별했고, 나는 그 시간이 엄마의 것이 되도록 복도에서 바쁜 척을 했다. 그러고는 가는 길이라며 바다에 들렀다. 사실 가는 길이 아니었다. 방파제에 앉아 귤을 하나씩 까먹었고, 말은 많지 않았다.',
          memories: {
            'm-goodbye-to-the-kitchen': {
              name: '불을 끄고 한 작별',
              currentText:
                '엄마는 불을 끈 부엌에 대고 조용히 작별했다. 나는 그 시간이 엄마의 것이 되도록 복도에서 바쁜 척을 했다.',
              semanticStages: [
                '엄마가 혼자 부엌과 작별하는 동안 나는 복도에서 기다렸다.',
                '방 하나에 건넨 조용한 작별.',
                '그 시간은 엄마의 것이었다.',
                '불을 끄고.',
              ],
              decayStages: [
                '엄마는 불을 끈 xxxx 대고 조용히 작별했다. 나는 xxxx 시간이 엄마의 것이 되도록 복도에서 바쁜 척을 했다.',
                '엄마는 불을 끈 xxxx xxxx xxxx 작별했다. 나는 xxxx 시간이 엄마의 것이 되도록 복도에서 바쁜 xxxx 했다.',
                '엄마는 불을 끈 xxxx xxxx xxxx 작별했다. 나는 xxxx xxxx xxxx 것이 되도록 복도에서 바쁜 xxxx 했다.',
                '엄마는 xxxx xxxx xxxx xxxx xxxx 작별했다. 나는 xxxx xxxx xxxx 것이 xxxx xxxx 바쁜 xxxx 했다.',
              ],
            },
            'm-tangerine-on-the-wall': {
              name: '방파제 위의 귤',
              currentText:
                '가는 길이라며 바다에 들렀다. 사실 가는 길이 아니었다. 물 위 방파제에 앉아 귤을 하나씩 까먹었고, 말은 많지 않았다.',
              semanticStages: [
                '가는 길이 아닌 바다에 들러 방파제에서 귤을 나눠 먹었다.',
                '핑계 같은 길, 물 위의 귤.',
                '바닷가의 귤 하나.',
                '가는 길이라며.',
              ],
              decayStages: [
                '가는 xxxx 바다에 들렀다. 사실 가는 길이 아니었다. 물 위 xxxx 앉아 귤을 하나씩 까먹었고, 말은 많지 않았다.',
                '가는 xxxx 바다에 들렀다. 사실 xxxx xxxx 아니었다. 물 위 xxxx 앉아 귤을 하나씩 까먹었고, 말은 많지 않았다.',
                '가는 xxxx 바다에 들렀다. 사실 xxxx xxxx 아니었다. 물 위 xxxx xxxx 귤을 하나씩 xxxx 말은 xxxx 않았다.',
                '가는 xxxx xxxx 들렀다. 사실 xxxx xxxx 아니었다. 물 xxxx xxxx xxxx 귤을 xxxx xxxx 말은 xxxx 않았다.',
              ],
            },
          },
        },
        'd-winter-sea-6': {
          body: '설거지를 하는데 엄마가 새집에서 전화를 걸어왔고, 모처럼 아무것도 아닌 이야기만 했다. 이제 엄마의 부엌은 배 한 척만 한데, 조용한 밤이면 바다 소리가 들릴 만큼 가깝다고 한다. 나는 그 말을 믿기로 했다. 통화 내내 싱크대 위 불이 켜져 있었고, 끊고 나서도 한동안 그대로 두었다.',
          memories: {
            'm-kitchen-the-size-of-a-boats': {
              name: '배 한 척만 한 부엌',
              currentText:
                '엄마의 새 부엌은 배 한 척만 하다. 조용한 밤이면 바다 소리가 들릴 만큼 가깝다고 했고, 나는 그 말을 믿기로 했다.',
              semanticStages: [
                '엄마의 작은 새 부엌은 바다 소리가 들릴 만큼 가깝다고 한다.',
                '물 가까이의 작은 부엌.',
                '바다가 들리는 거리.',
                '들릴 만큼 가까이.',
              ],
              decayStages: [
                '엄마의 새 부엌은 배 한 척만 하다. 조용한 밤이면 바다 소리가 xxxx 만큼 xxxx 했고, 나는 그 xxxx 믿기로 했다.',
                '엄마의 xxxx 부엌은 xxxx xxxx 척만 하다. 조용한 밤이면 바다 소리가 xxxx 만큼 xxxx 했고, 나는 그 xxxx 믿기로 했다.',
                '엄마의 xxxx 부엌은 xxxx xxxx xxxx 하다. 조용한 밤이면 바다 소리가 xxxx 만큼 xxxx xxxx 나는 xxxx xxxx 믿기로 했다.',
                '엄마의 xxxx 부엌은 xxxx xxxx xxxx 하다. 조용한 xxxx xxxx xxxx xxxx 만큼 xxxx xxxx 나는 xxxx xxxx xxxx 했다.',
              ],
            },
            'm-light-left-on': {
              name: '통화가 끝나고 켜둔 불',
              currentText:
                '아무것도 아닌 통화를 하는 내내 싱크대 위 불이 켜져 있었다. 엄마가 끊고 나서도 한동안 그대로 두었다.',
              semanticStages: [
                '아무것도 아닌 통화 동안 켜져 있던 불을 끊고 나서도 두었다.',
                '아무 이야기의 통화, 켜둔 불.',
                '끊고 나서도 한동안.',
                '아직 켜진 채로.',
              ],
              decayStages: [
                '아무것도 아닌 통화를 하는 내내 싱크대 xxxx xxxx 켜져 있었다. 엄마가 끊고 나서도 한동안 그대로 두었다.',
                '아무것도 아닌 통화를 하는 내내 싱크대 xxxx xxxx 켜져 있었다. 엄마가 끊고 나서도 xxxx xxxx 두었다.',
                '아무것도 xxxx 통화를 하는 xxxx 싱크대 xxxx xxxx 켜져 있었다. 엄마가 끊고 xxxx xxxx xxxx 두었다.',
                '아무것도 xxxx 통화를 xxxx xxxx xxxx xxxx xxxx xxxx 있었다. 엄마가 끊고 xxxx xxxx xxxx 두었다.',
              ],
            },
          },
        },
      },
    },
  },
}
