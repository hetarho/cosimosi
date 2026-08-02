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
    extraDiaries: [
      {
        id: 'd-rooftop-4',
        dayOffset: 124,
        memories: [
          {
            id: 'm-cat-out-of-the-rain',
            mood: 'JOY',
            intensity: 0.7,
            seed: 61_003n,
            activations: [
              { neuronId: 'n-cat', weight: 0.88 },
              { neuronId: 'n-rain', weight: 0.72 },
            ],
          },
          {
            id: 'm-new-deadline-in-the-rain',
            mood: 'STRESS',
            intensity: 0.63,
            seed: 61_007n,
            activations: [
              { neuronId: 'n-deadline', weight: 0.8 },
              { neuronId: 'n-rain', weight: 0.58 },
            ],
          },
        ],
      },
      {
        id: 'd-rooftop-5',
        dayOffset: 142,
        memories: [
          {
            id: 'm-cat-approved-of-him',
            mood: 'JOY',
            intensity: 0.72,
            seed: 62_009n,
            activations: [
              { neuronId: 'n-cat', weight: 0.84 },
              { neuronId: 'n-friend', weight: 0.8 },
            ],
          },
          {
            id: 'm-he-read-the-draft',
            mood: 'GRATITUDE',
            intensity: 0.67,
            seed: 62_013n,
            activations: [
              { neuronId: 'n-deadline', weight: 0.74 },
              { neuronId: 'n-friend', weight: 0.7 },
            ],
          },
        ],
      },
      {
        id: 'd-rooftop-6',
        dayOffset: 159,
        memories: [
          {
            id: 'm-sent-it-from-up-there',
            mood: 'RELIEF',
            intensity: 0.77,
            seed: 63_011n,
            activations: [
              { neuronId: 'n-deadline', weight: 0.86 },
              { neuronId: 'n-rooftop', weight: 0.7 },
            ],
          },
          {
            id: 'm-landlords-circuit',
            mood: 'CALM',
            intensity: 0.6,
            seed: 63_017n,
            activations: [
              { neuronId: 'n-cat', weight: 0.76 },
              { neuronId: 'n-rooftop', weight: 0.66 },
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
      {
        id: 's-rooftop-7',
        neuronAId: 'n-cat',
        neuronBId: 'n-rain',
        strength: 0.33,
        coActivationCount: 1,
        lastActivatedDayOffset: 124,
      },
      {
        id: 's-rooftop-8',
        neuronAId: 'n-deadline',
        neuronBId: 'n-rain',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedDayOffset: 124,
      },
      {
        id: 's-rooftop-9',
        neuronAId: 'n-cat',
        neuronBId: 'n-friend',
        strength: 0.35,
        coActivationCount: 1,
        lastActivatedDayOffset: 142,
      },
      {
        id: 's-rooftop-10',
        neuronAId: 'n-deadline',
        neuronBId: 'n-friend',
        strength: 0.34,
        coActivationCount: 1,
        lastActivatedDayOffset: 142,
      },
    ],
    sharedNeuronIds: ['n-cat', 'n-deadline', 'n-friend', 'n-rooftop'],
  },
  scenario: {
    beats: DEMO_BEAT_IDS,
    firstDiaryId: 'd-rooftop-1',
    // TIRED, against on-screen memories whose weighted blend leans EXCITEMENT. In the second
    // diary, because the tutorial has launched exactly two diaries when the recall beat arrives.
    recallMemoryId: 'm-two-in-the-morning',
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
              reconsolidatedText:
                'It was the cat I kept, not the work — asleep on the warm lid until two, and the forgiveness that came the moment I stopped moving her.',
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
        'd-rooftop-4': {
          body: 'The first cold rain of autumn came sideways and Byeol appeared at my door instead of the ledge, offended by the whole sky. I let her in, which we had both agreed never to do. A new deadline opened in my inbox while it rained, and I read the brief twice at the window without minding it much.',
          memories: {
            'm-cat-out-of-the-rain': {
              name: 'Byeol, out of the rain',
              currentText:
                'The first cold rain came sideways and the cat appeared at my door, offended by the whole sky. I let her in, which we had agreed never to do.',
              semanticStages: [
                'The cat came to my door out of the first cold rain and I let her in.',
                'A cat indoors, against the rules.',
                'Let in from the rain.',
                'Offended by the sky.',
              ],
              decayStages: [
                'The first cold rain came sideways and the cat appeared at my xxxx offended by the xxxx sky. I let her in, xxxx we had xxxx xxxx to do.',
                'The xxxx cold xxxx xxxx sideways and the cat appeared at my xxxx xxxx by the xxxx sky. I xxxx her in, xxxx we had xxxx xxxx to do.',
                'The xxxx xxxx xxxx xxxx xxxx and the xxxx xxxx at my xxxx xxxx by the xxxx sky. I xxxx xxxx in, xxxx we had xxxx xxxx to do.',
                'The xxxx xxxx xxxx xxxx xxxx and xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx the xxxx sky. I xxxx xxxx in, xxxx we xxxx xxxx xxxx xxxx do.',
              ],
            },
            'm-new-deadline-in-the-rain': {
              name: 'A new deadline, read at the window',
              currentText:
                'A new deadline opened in my inbox while it rained. I read the brief twice at the window and minded it less than I expected to.',
              semanticStages: [
                'A new deadline arrived with the rain and bothered me less than expected.',
                'New work, read against the rain.',
                'Read twice at the window.',
                'Minded less.',
              ],
              decayStages: [
                'A new deadline xxxx in my inbox while it rained. I xxxx the brief xxxx at the xxxx and minded it less than I expected to.',
                'A new deadline xxxx in my xxxx xxxx it rained. I xxxx the brief xxxx at the xxxx and minded it less xxxx I xxxx to.',
                'A xxxx xxxx xxxx in my xxxx xxxx it rained. I xxxx the xxxx xxxx at the xxxx and xxxx it xxxx xxxx I xxxx to.',
                'A xxxx xxxx xxxx xxxx my xxxx xxxx it rained. I xxxx xxxx xxxx xxxx xxxx the xxxx and xxxx xxxx xxxx xxxx xxxx xxxx to.',
              ],
            },
          },
        },
        'd-rooftop-5': {
          body: 'Jihun finally met Byeol, who inspected him for a long minute and then sat on his notebook as a verdict. He read my draft on the rooftop while the light went, said the middle was better than I thought and the ending worse, and he was right twice. I paid him in the last of the melon story, retold badly.',
          memories: {
            'm-cat-approved-of-him': {
              name: 'Byeol’s verdict on Jihun',
              currentText:
                'Byeol inspected Jihun for a long minute and then sat down on his notebook. He took the verdict better than most people take compliments.',
              semanticStages: [
                'The cat inspected Jihun and settled on his notebook, and he was pleased.',
                'An inspection passed, a notebook claimed.',
                'She approved of him.',
                'Verdict delivered.',
              ],
              decayStages: [
                'Byeol xxxx Jihun for a long xxxx and then sat down on his notebook. He took the verdict better xxxx most xxxx take compliments.',
                'Byeol xxxx xxxx for a long xxxx and then xxxx xxxx on his notebook. He took the verdict better xxxx xxxx xxxx take compliments.',
                'Byeol xxxx xxxx for a xxxx xxxx and then xxxx xxxx on xxxx notebook. He xxxx the verdict xxxx xxxx xxxx xxxx take compliments.',
                'Byeol xxxx xxxx for a xxxx xxxx and xxxx xxxx xxxx xxxx xxxx notebook. He xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx compliments.',
              ],
            },
            'm-he-read-the-draft': {
              name: 'He read the draft as the light went',
              currentText:
                'He read my draft on the rooftop while the light went. He said the middle was better than I thought and the ending worse, and he was right twice.',
              semanticStages: [
                'Jihun read the draft at dusk and was right about it twice.',
                'An honest reading on the rooftop.',
                'Right about it twice.',
                'He read it.',
              ],
              decayStages: [
                'He xxxx my xxxx on the xxxx xxxx the light went. He said the middle was better than I thought and the ending worse, and he was xxxx twice.',
                'He xxxx my xxxx on the xxxx xxxx the xxxx went. He xxxx the xxxx was better xxxx I xxxx and the ending worse, and he was xxxx twice.',
                'He xxxx my xxxx on xxxx xxxx xxxx the xxxx went. He xxxx the xxxx was xxxx xxxx xxxx xxxx and the xxxx xxxx and he was xxxx twice.',
                'He xxxx xxxx xxxx on xxxx xxxx xxxx the xxxx went. He xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx he was xxxx twice.',
              ],
            },
          },
        },
        'd-rooftop-6': {
          body: 'I sent the work off from the rooftop because it seemed only fair that the place that watched the worst of it should see it go. The evening was the last really warm one, and Byeol did a full slow circuit of the ledge like a landlord satisfied with the season. I stayed up there long after the send button, doing nothing that could be called anything.',
          memories: {
            'm-sent-it-from-up-there': {
              name: 'Sent, from where it was suffered',
              currentText:
                'I sent the work off from the rooftop, since the place that watched the worst of it deserved to see it go. The button took one second of a whole season.',
              semanticStages: [
                'I submitted the work from the rooftop that had watched me struggle with it.',
                'The send button, pressed where it was earned.',
                'Sent it from up there.',
                'It went.',
              ],
              decayStages: [
                'I sent the xxxx xxxx xxxx the rooftop, since the place that xxxx the worst of it deserved to xxxx it go. The button took one second of a whole season.',
                'I xxxx the xxxx xxxx xxxx the xxxx since the place that xxxx the worst of it xxxx to xxxx it go. The button took xxxx xxxx of a whole season.',
                'I xxxx the xxxx xxxx xxxx the xxxx xxxx the xxxx that xxxx the xxxx of it xxxx to xxxx it go. The xxxx xxxx xxxx xxxx of a xxxx season.',
                'I xxxx the xxxx xxxx xxxx xxxx xxxx xxxx the xxxx that xxxx xxxx xxxx of xxxx xxxx to xxxx xxxx go. The xxxx xxxx xxxx xxxx xxxx xxxx xxxx season.',
              ],
            },
            'm-landlords-circuit': {
              name: 'A landlord’s slow circuit',
              currentText:
                'The evening was the last really warm one. Byeol did a slow full circuit of the ledge, like a landlord satisfied with the season.',
              semanticStages: [
                'On the last warm evening the cat toured the ledge like a satisfied landlord.',
                'A season signed off by a cat.',
                'The last warm evening.',
                'Satisfied.',
              ],
              decayStages: [
                'The xxxx was the xxxx xxxx warm one. Byeol did a slow full xxxx of the ledge, like a landlord satisfied with the season.',
                'The xxxx was the xxxx xxxx warm one. Byeol xxxx a xxxx xxxx xxxx of the ledge, like a xxxx satisfied with the season.',
                'The xxxx was the xxxx xxxx xxxx one. Byeol xxxx a xxxx xxxx xxxx of the xxxx xxxx a xxxx xxxx with the season.',
                'The xxxx was xxxx xxxx xxxx xxxx one. Byeol xxxx xxxx xxxx xxxx xxxx of xxxx xxxx xxxx xxxx xxxx xxxx with xxxx season.',
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
              reconsolidatedText:
                '남은 것은 일이 아니라 고양이였다. 두 시까지 따뜻한 뚜껑 위에서 자던 무게와, 옮기자마자 돌아온 용서.',
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
        'd-rooftop-4': {
          body: '가을의 첫 찬비가 옆으로 들이쳤고, 별이가 난간 대신 현관 앞에 나타났다. 하늘 전체에 골이 난 얼굴이었다. 절대 하지 않기로 했던 일이지만 들여보내 주었다. 비가 오는 사이 메일함에 새 마감이 열렸고, 나는 창가에서 브리프를 두 번 읽었다. 생각보다 마음이 상하지 않았다.',
          memories: {
            'm-cat-out-of-the-rain': {
              name: '비를 피해 온 별이',
              currentText:
                '가을의 첫 찬비가 들이쳤고, 고양이가 하늘 전체에 골이 난 얼굴로 현관 앞에 나타났다. 절대 하지 않기로 했던 일이지만, 들여보내 주었다.',
              semanticStages: [
                '첫 찬비에 문 앞으로 온 고양이를 들여보내 주었다.',
                '규칙을 어기고 들어온 고양이.',
                '비를 피해 들어온 것.',
                '하늘에 골이 나서.',
              ],
              decayStages: [
                '가을의 첫 찬비가 들이쳤고, 고양이가 하늘 전체에 골이 난 얼굴로 현관 xxxx 나타났다. 절대 하지 않기로 xxxx 일이지만, xxxx 주었다.',
                '가을의 첫 찬비가 들이쳤고, 고양이가 하늘 전체에 xxxx 난 얼굴로 xxxx xxxx 나타났다. 절대 xxxx 않기로 xxxx 일이지만, xxxx 주었다.',
                '가을의 xxxx 찬비가 들이쳤고, xxxx 하늘 전체에 xxxx 난 얼굴로 xxxx xxxx 나타났다. 절대 xxxx 않기로 xxxx xxxx xxxx 주었다.',
                '가을의 xxxx xxxx xxxx xxxx 하늘 xxxx xxxx xxxx 얼굴로 xxxx xxxx 나타났다. 절대 xxxx 않기로 xxxx xxxx xxxx 주었다.',
              ],
            },
            'm-new-deadline-in-the-rain': {
              name: '창가에서 읽은 새 마감',
              currentText:
                '비가 오는 사이 메일함에 새 마감이 열렸다. 창가에서 브리프를 두 번 읽었는데, 생각보다 마음이 상하지 않았다.',
              semanticStages: [
                '비와 함께 도착한 새 마감이 생각보다 괴롭지 않았다.',
                '비를 등지고 읽은 새 일.',
                '창가에서 두 번 읽었다.',
                '덜 상한 마음.',
              ],
              decayStages: [
                '비가 오는 사이 메일함에 xxxx 마감이 열렸다. 창가에서 브리프를 두 번 xxxx 생각보다 마음이 상하지 않았다.',
                '비가 오는 사이 xxxx xxxx 마감이 열렸다. 창가에서 브리프를 두 번 xxxx 생각보다 마음이 xxxx 않았다.',
                '비가 오는 xxxx xxxx xxxx 마감이 열렸다. 창가에서 브리프를 xxxx 번 xxxx xxxx 마음이 xxxx 않았다.',
                '비가 xxxx xxxx xxxx xxxx 마감이 열렸다. 창가에서 xxxx xxxx 번 xxxx xxxx xxxx xxxx 않았다.',
              ],
            },
          },
        },
        'd-rooftop-5': {
          body: '지훈이 드디어 별이를 만났다. 별이는 그를 한참 뜯어보더니 판결처럼 노트 위에 앉았고, 지훈은 칭찬을 받은 사람보다 더 기뻐했다. 해가 지는 동안 그는 옥상에서 내 초고를 읽었다. 중간은 내 생각보다 낫고 결말은 더 나쁘다고 했는데, 두 번 다 맞는 말이었다. 나는 지난 멜론 이야기를 형편없이 다시 들려주는 것으로 값을 치렀다.',
          memories: {
            'm-cat-approved-of-him': {
              name: '별이가 내린 판결',
              currentText:
                '별이는 지훈을 한참 뜯어보더니 판결처럼 그의 노트 위에 앉았다. 지훈은 대부분의 사람이 칭찬을 받을 때보다 더 기뻐했다.',
              semanticStages: [
                '별이가 지훈을 살펴보고 노트 위에 앉았고, 그는 기뻐했다.',
                '통과된 심사, 차지된 노트.',
                '별이의 승인.',
                '판결이 내려졌다.',
              ],
              decayStages: [
                '별이는 xxxx 한참 뜯어보더니 판결처럼 그의 xxxx 위에 앉았다. 지훈은 대부분의 사람이 칭찬을 받을 때보다 더 기뻐했다.',
                '별이는 xxxx xxxx 뜯어보더니 판결처럼 그의 xxxx 위에 앉았다. 지훈은 xxxx 사람이 칭찬을 xxxx 때보다 더 기뻐했다.',
                '별이는 xxxx xxxx 뜯어보더니 판결처럼 xxxx xxxx 위에 앉았다. 지훈은 xxxx xxxx 칭찬을 xxxx 때보다 더 기뻐했다.',
                '별이는 xxxx xxxx 뜯어보더니 xxxx xxxx xxxx 위에 앉았다. 지훈은 xxxx xxxx xxxx xxxx xxxx xxxx 기뻐했다.',
              ],
            },
            'm-he-read-the-draft': {
              name: '해가 지는 동안 읽어준 초고',
              currentText:
                '해가 지는 동안 지훈이 옥상에서 내 초고를 읽었다. 중간은 내 생각보다 낫고 결말은 더 나쁘다고 했는데, 두 번 다 맞는 말이었다.',
              semanticStages: [
                '지훈이 노을 속에서 초고를 읽고 두 번 다 맞는 말을 했다.',
                '옥상에서의 정직한 독서.',
                '두 번 다 맞았다.',
                '읽어주었다.',
              ],
              decayStages: [
                '해가 xxxx 동안 지훈이 옥상에서 내 xxxx 읽었다. 중간은 내 생각보다 낫고 결말은 더 나쁘다고 했는데, 두 번 xxxx 맞는 말이었다.',
                '해가 xxxx 동안 지훈이 옥상에서 xxxx xxxx 읽었다. 중간은 내 생각보다 xxxx 결말은 xxxx 나쁘다고 했는데, 두 번 xxxx 맞는 말이었다.',
                '해가 xxxx 동안 xxxx 옥상에서 xxxx xxxx 읽었다. 중간은 xxxx 생각보다 xxxx 결말은 xxxx 나쁘다고 xxxx 두 번 xxxx xxxx 말이었다.',
                '해가 xxxx xxxx xxxx 옥상에서 xxxx xxxx 읽었다. 중간은 xxxx xxxx xxxx xxxx xxxx 나쁘다고 xxxx 두 xxxx xxxx xxxx 말이었다.',
              ],
            },
          },
        },
        'd-rooftop-6': {
          body: '일을 옥상에서 보냈다. 가장 힘든 시간을 지켜본 자리가 끝나는 것도 봐야 공평할 것 같았다. 그날 저녁이 마지막으로 정말 따뜻한 저녁이었고, 별이는 계절에 만족한 집주인처럼 난간을 천천히 한 바퀴 돌았다. 전송 버튼을 누르고도 한참을 위에 있었다. 무엇이라 부를 수 없는 일들을 하면서.',
          memories: {
            'm-sent-it-from-up-there': {
              name: '견딘 자리에서 보낸 것',
              currentText:
                '일을 옥상에서 보냈다. 가장 힘든 시간을 지켜본 자리가 끝나는 것도 봐야 공평할 것 같았다. 한 계절이 걸린 일에 버튼은 일 초였다.',
              semanticStages: [
                '고생을 지켜본 옥상에서 작업을 제출했다.',
                '견딘 자리에서 누른 전송.',
                '거기서 보냈다.',
                '보내졌다.',
              ],
              decayStages: [
                '일을 옥상에서 보냈다. 가장 xxxx 시간을 지켜본 자리가 끝나는 것도 봐야 공평할 xxxx 같았다. 한 계절이 걸린 일에 버튼은 xxxx 초였다.',
                '일을 옥상에서 보냈다. 가장 xxxx xxxx 지켜본 자리가 끝나는 것도 봐야 공평할 xxxx 같았다. 한 계절이 xxxx xxxx 버튼은 xxxx 초였다.',
                '일을 xxxx 보냈다. 가장 xxxx xxxx xxxx xxxx 끝나는 것도 봐야 공평할 xxxx 같았다. 한 계절이 xxxx xxxx 버튼은 xxxx 초였다.',
                '일을 xxxx 보냈다. 가장 xxxx xxxx xxxx xxxx 끝나는 xxxx xxxx 공평할 xxxx 같았다. 한 계절이 xxxx xxxx xxxx xxxx 초였다.',
              ],
            },
            'm-landlords-circuit': {
              name: '집주인의 느린 순찰',
              currentText:
                '그날 저녁이 마지막으로 정말 따뜻한 저녁이었다. 별이는 계절에 만족한 집주인처럼 난간을 천천히 한 바퀴 돌았다.',
              semanticStages: [
                '마지막 따뜻한 저녁, 고양이가 난간을 집주인처럼 돌았다.',
                '고양이가 결재한 한 계절.',
                '마지막 따뜻한 저녁.',
                '만족한 채로.',
              ],
              decayStages: [
                '그날 xxxx 마지막으로 정말 따뜻한 저녁이었다. 별이는 계절에 만족한 집주인처럼 난간을 천천히 한 xxxx 돌았다.',
                '그날 xxxx 마지막으로 정말 xxxx 저녁이었다. 별이는 계절에 만족한 집주인처럼 난간을 xxxx 한 xxxx 돌았다.',
                '그날 xxxx 마지막으로 정말 xxxx 저녁이었다. 별이는 계절에 만족한 xxxx 난간을 xxxx xxxx xxxx 돌았다.',
                '그날 xxxx 마지막으로 xxxx xxxx 저녁이었다. 별이는 xxxx 만족한 xxxx xxxx xxxx xxxx xxxx 돌았다.',
              ],
            },
          },
        },
      },
    },
  },
}
