// One-off generator for the demo universe (spec 19/22/38). Instead of hand-drawing synapses,
// we SIMULATE ~6 months of journaling (2–3 entries/week) and let the connection rules form the
// graph the way the real backend would:
//   • chronological linking — each new entry links to its top-k most semantically-similar PRIOR
//     entries (similarity ≈ topic-vector cosine, a stand-in for embeddings), weight = f(sim) +
//     temporal_bonus (same-week boost), capped < 0.8 (spec 05/21).
//   • recall sessions — the user occasionally re-reads a cluster of old memories; that re-ignites
//     them (last_recalled = recall day → they brighten and migrate inward, spec 12/38) and forges
//     co_recall synapses between co-read pairs (spec 11).
//   • decay — an entry never recalled keeps its creation age (dim/outer); recalled ones reset.
// Run:  node frontend/scripts/gen-demo-universe.mjs   → prints DEMO_ENTRIES + DEMO_EDGES TS.

const KNN_K = 5 // top-k semantic neighbors a new entry may link to
const SIM_TAU = 0.5 // similarity floor to qualify as a neighbor
const SEM_CAP = 0.79 // cross-entry semantic weight cap (< intra 0.8)
const TEMPORAL_DAYS = 7 // same-week temporal bonus window
const TEMPORAL_MAX = 0.3
const ENTITY_TOPICS = new Set(['mom', 'grandma', 'partner', 'friend', 'pet'])

// ageDays = days before "now" the entry was written (oldest first). topics drive similarity.
const E = [
  ['work', 182, 'STRESS', 0.6, ['work'], '첫 출근. 모든 게 낯설고 이름조차 못 외운 얼굴들 사이에서 하루 종일 긴장했다.'],
  ['walk0', 178, 'CALM', 0.45, ['nature'], '퇴근길에 낯선 동네를 한 바퀴 걸었다. 길을 모르니 오히려 천천히 보게 된다.'],
  ['run0', 175, 'EXCITEMENT', 0.6, ['running', 'health'], '큰맘 먹고 러닝화를 샀다. 내일부터 뛴다 다짐했는데, 다짐만으로 벌써 설렌다.'],
  ['mom0', 171, 'LOVE', 0.8, ['mom', 'family'], '엄마가 보낸 반찬 택배. 김치통 사이에 끼워둔 쪽지 한 장에 코끝이 시큰했다.'],
  ['work1', 168, 'FEAR', 0.55, ['work'], '첫 주간회의에서 한마디도 못 했다. 다들 아는 얘기를 나만 모르는 것 같아 손에 땀이 났다.'],
  ['run1', 164, 'TIRED', 0.5, ['running', 'health'], '첫 달리기. 5분 만에 숨이 턱까지 찼다. 작심삼일이 될까 무섭지만 일단 나갔다.'],
  ['friend0', 160, 'JOY', 0.7, ['friend'], '오랜 친구와 보드게임. 배가 아플 때까지 웃었다. 어른이 되어도 이렇게 유치할 수 있어 다행이다.'],
  ['ptn0', 157, 'LOVE', 0.7, ['partner', 'love'], '소개로 만난 사람과 두 번째 만남. 헤어지고도 대화가 자꾸 떠올라 잠을 설쳤다.'],
  ['work2', 151, 'CALM', 0.5, ['work'], '이제 회의에서 질문 하나는 한다. 작은 건데도 내 자리가 조금 생긴 기분.'],
  ['walk1', 147, 'CALM', 0.5, ['nature'], '한강에서 노을을 봤다. 주황빛이 물 위로 길게 번지는 걸 한참 멍하니 바라봤다.'],
  ['read0', 143, 'JOY', 0.65, ['reading'], '오래 기다린 책이 도착했다. 포장을 뜯기 전 이 설렘이 제일 좋다.'],
  ['run2', 139, 'RELIEF', 0.6, ['running', 'health'], '드디어 쉬지 않고 2km. 별것 아닌데 끝나고 혼자 주먹을 불끈 쥐었다.'],
  ['gma0', 135, 'LOVE', 0.82, ['grandma', 'family'], "할머니 댁. 내 손을 꼭 잡고 '밥은 잘 챙겨 먹니' 하시는데 그 온기가 며칠째 남는다."],
  ['ptn1', 131, 'LOVE', 0.85, ['partner', 'love'], '그 사람과 처음 같이 요리를 했다. 다 태웠지만 주방에서 부딪힌 어깨가 자꾸 생각난다.'],
  ['work3', 127, 'EXCITEMENT', 0.7, ['work'], '내 아이디어가 처음으로 회의에서 채택됐다. 별것 아닌 기능 하나인데 종일 붕 떠 있었다.'],
  ['ord0', 123, 'NEUTRAL', 0.4, ['ordinary'], '특별할 것 없는 하루. 출근, 일, 점심, 일, 퇴근. 무탈하다는 게 어떤 날엔 가장 큰 다행이다.'],
  ['pet0', 119, 'LOVE', 0.7, ['pet'], '길고양이 한 마리가 며칠째 현관 앞에 온다. 사료를 두니 경계하면서도 먹는다. 이름을 붙여버렸다.'],
  ['read1', 115, 'CALM', 0.5, ['reading'], '오랜만에 손글씨로 편지를 썼다. 펜으로 쓰니 문장 하나하나가 천천히 익었다.'],
  ['work4', 111, 'STRESS', 0.68, ['work'], '회의에서 또 말이 끊겼다. 끝까지 못 한 그 문장이 하루 종일 목에 걸려 있었다.'],
  ['ptn2', 107, 'ANGER', 0.6, ['partner', 'love'], '약속을 또 일방적으로 미뤘다. 화가 났다기보다, 매번 기다리는 쪽이 나라는 게 서글펐다.'],
  ['walk2', 103, 'CALM', 0.48, ['nature'], '주말 아침 산책. 공기가 차고 맑았다. 이어폰을 빼고 새소리만 들으며 걸었다.'],
  ['run3', 99, 'JOY', 0.72, ['running', 'health'], '처음으로 5km를 완주했다. 다리가 풀렸지만 끝까지 뛰었다는 게 믿기지 않는다.'],
  ['friend1', 95, 'SAD', 0.58, ['friend'], '친한 동료가 이직한다. 축하한다고 했지만 빈 옆자리를 상상하니 마음이 가라앉았다.'],
  ['ptn3', 91, 'LOVE', 0.8, ['partner', 'love'], "다툰 뒤 처음으로 먼저 연락이 왔다. '미안해' 한마디에 며칠 묵은 게 스르르 풀렸다."],
  ['work5', 87, 'CALM', 0.52, ['work'], '프로젝트가 본격적으로 굴러간다. 바쁘지만 내가 맡은 자리가 분명해진 느낌.'],
  ['mom1', 83, 'GRATITUDE', 0.7, ['mom', 'family'], '엄마와 한 시간 통화. 별 내용 없었는데 끊고 나니 괜히 든든했다.'],
  ['pet1', 79, 'SAD', 0.75, ['pet', 'loss'], '현관 앞 그 고양이가 며칠째 안 보인다. 밥그릇만 그대로다. 내가 너무 정을 줬나.'],
  ['dec0', 75, 'FEAR', 0.6, ['decision', 'work'], '다른 팀으로 옮길 기회가 왔다. 좋은 제안인데 왜 이렇게 무섭지. 고르는 일 자체가 두렵다.'],
  ['read2', 71, 'JOY', 0.6, ['reading'], '지하철에서 읽던 책의 마지막 장을 덮었다. 다 읽기 아까워 일부러 천천히 읽었는데.'],
  ['walk3', 67, 'CALM', 0.5, ['nature'], '비 오는 카페 창가. 따뜻한 라떼와 책 한 권. 아무것도 안 해도 되는 오후가 귀하다.'],
  ['ptn4', 63, 'LOVE', 0.88, ['partner', 'love'], '함께 본 영화가 끝나고도 한참 자리에 앉아 있었다. 말없이 있어도 편한 사람이 생겼다.'],
  ['dec1', 59, 'STRESS', 0.62, ['decision', 'work'], '팀 이동을 두고 계속 저울질. 어느 쪽을 골라도 후회할 것 같아 밤마다 천장만 본다.'],
  ['gma1', 55, 'FEAR', 0.65, ['grandma', 'family'], '할머니가 입원하셨다는 연락. 별일 아니라는데도 자꾸 최악을 그리게 된다.'],
  ['run4', 51, 'CALM', 0.5, ['running', 'health'], '오랜만에 강변을 달렸다. 생각이 많을 땐 다리를 움직이는 게 약이 된다.'],
  ['dec2', 47, 'RELIEF', 0.7, ['decision', 'work'], '결국 팀을 옮기기로 했다. 정하고 나니, 무서웠던 게 무색하게 마음이 가벼워졌다.'],
  ['mom2', 43, 'LOVE', 0.78, ['mom', 'family'], '주말 본가. 엄마가 끓여준 미역국 냄새에 잠을 깼다. 사랑받는다는 건 이런 거구나.'],
  ['ptn5', 39, 'ANGER', 0.55, ['partner', 'love'], '사소한 걸로 또 부딪혔다. 같은 얘기를 반복하는 우리가 잠깐 미웠다.'],
  ['friend2', 35, 'JOY', 0.68, ['friend'], '길에서 우연히 옛 친구를 만났다. 10년 만인데 어제 본 것처럼 떠들었다.'],
  ['work6', 31, 'EXCITEMENT', 0.8, ['work'], '새 팀 첫 발표가 성공적으로 끝났다. 팀원들과 하이파이브할 때의 열기를 오래 기억하고 싶다.'],
  ['walk4', 28, 'CALM', 0.46, ['nature'], '퇴근길 골목에 목련이 폈다. 봄이 오는 걸 늘 꽃이 먼저 알려준다.'],
  ['read3', 26, 'GRATITUDE', 0.6, ['reading'], '힘들 때 펼친 책의 한 문장이 오늘의 나를 정확히 통과했다. 누가 나 대신 써둔 것 같았다.'],
  ['ptn6', 23, 'LOVE', 0.85, ['partner', 'love'], '다툼 끝에 오래 이야기했다. 서로의 서툰 데를 조금 더 알게 됐다. 이런 게 가까워지는 거겠지.'],
  ['gma2', 20, 'RELIEF', 0.7, ['grandma', 'family'], '할머니가 퇴원하셨다. 전화기 너머 목소리에 기운이 돌아 한참을 웃으며 통화했다.'],
  ['run5', 17, 'JOY', 0.9, ['running', 'health'], '10km 대회 완주. 결승선 앞에서 다리가 풀렸지만 끝까지 뛰었다. 반년 전의 나는 상상도 못 했다.'],
  ['mov0', 14, 'STRESS', 0.55, ['moving'], '이사를 결정했다. 짐을 싸려고 둘러보니 이 방에 쌓인 시간이 새삼 무겁다.'],
  ['ptn7', 11, 'LOVE', 0.82, ['partner', 'love'], '함께 새집을 보러 다녔다. 빈방을 보며 같은 상상을 하고 있다는 걸 알았다.'],
  ['friend3', 9, 'SAD', 0.5, ['friend'], '이직한 동료의 송별 모임. 웃으며 보냈지만 돌아오는 길은 좀 허전했다.'],
  ['mom3', 7, 'GRATITUDE', 0.72, ['mom', 'family'], '이사 소식에 엄마가 제일 먼저 반찬부터 걱정한다. 그 잔소리가 오늘은 고마웠다.'],
  ['mov1', 6, 'CALM', 0.5, ['moving'], '대청소를 했다. 안 쓰는 물건을 한 봉지 비웠더니 방도 마음도 그만큼 가벼워졌다.'],
  ['read4', 5, 'JOY', 0.62, ['reading'], '이사 가기 전 동네 책방에 들렀다. 단골이 되기도 전에 떠나는 게 아쉬워 두 권을 샀다.'],
  ['ptn8', 4, 'LOVE', 0.9, ['partner', 'love'], '그 사람과 손을 잡고 걸었다. 별말 없었는데도 그 길이 끝나지 않길 바랐다.'],
  ['mov2', 3, 'NEUTRAL', 0.42, ['moving'], '이사 첫날. 텅 빈 방 한가운데 앉아 컵라면을 먹었다. 모든 게 새로 시작되는 묘한 고요함.'],
  ['work7', 3, 'CALM', 0.55, ['work'], '새 책상을 정리했다. 새 팀, 새 자리. 반년 전 첫 출근의 내가 떠올라 잠깐 웃었다.'],
  ['walk5', 2, 'EXCITEMENT', 0.6, ['nature'], '새집 창으로 들어오는 아침 볕이 좋다. 여기서 맞는 첫 주말이 기대된다.'],
]

const entries = E.map(([key, ageDays, mood, intensity, topics, body]) => ({
  key,
  ageDays,
  mood,
  intensity,
  topics,
  body,
  recalledDaysAgo: ageDays, // overwritten by recall sessions below
}))
const byKey = Object.fromEntries(entries.map((e) => [e.key, e]))

// Recall sessions (recent re-reads) — re-ignite old memories and link co-read pairs.
const RECALLS = [
  { daysAgo: 16, keys: ['run0', 'run2', 'run3', 'run5'] }, // after the 10k, relived the running journey
  { daysAgo: 45, keys: ['dec0', 'dec1', 'dec2'] }, // the decision thread, re-read once it resolved
  { daysAgo: 19, keys: ['gma0', 'gma1', 'gma2'] }, // grandma's recovery brought back the visits
  { daysAgo: 5, keys: ['pet0', 'pet1'] }, // the cat, still missed
  { daysAgo: 12, keys: ['ptn2', 'ptn3', 'ptn6'] }, // re-read the rough patch after making up
]

// cosine over topic sets (a stand-in for embedding similarity).
function sim(a, b) {
  let shared = 0
  for (const t of a.topics) if (b.topics.includes(t)) shared += 1
  return shared / Math.sqrt(a.topics.length * b.topics.length)
}
function temporalBonus(a, b) {
  const d = Math.abs(a.ageDays - b.ageDays)
  if (d >= TEMPORAL_DAYS) return 0
  return TEMPORAL_MAX * (1 - d / TEMPORAL_DAYS)
}
function entityShared(a, b) {
  return a.topics.some((t) => ENTITY_TOPICS.has(t) && b.topics.includes(t))
}

const pairKey = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`)
const edges = new Map() // pairKey -> {a,b,weight,linkType,lastActivatedDaysAgo}

// Chronological linking: oldest → newest, each new entry links to top-k similar PRIOR entries.
const chrono = [...entries].sort((a, b) => b.ageDays - a.ageDays) // oldest first
for (let i = 0; i < chrono.length; i++) {
  const self = chrono[i]
  const cands = []
  for (let j = 0; j < i; j++) {
    const other = chrono[j]
    const s = sim(self, other)
    if (s >= SIM_TAU) cands.push({ other, s })
  }
  cands.sort((p, q) => q.s - p.s || temporalBonus(self, q.other) - temporalBonus(self, p.other))
  for (const { other, s } of cands.slice(0, KNN_K)) {
    const w = Math.min(SEM_CAP, 0.42 + s * 0.4 + temporalBonus(self, other))
    const lt = entityShared(self, other) ? 'entity' : 'semantic'
    // link forms when the NEWER entry is written → lastActivated = its (smaller) age.
    edges.set(pairKey(self.key, other.key), {
      a: self.key,
      b: other.key,
      weight: Math.round(w * 100) / 100,
      linkType: lt,
      lastActivatedDaysAgo: Math.min(self.ageDays, other.ageDays),
    })
  }
}

// Recall sessions: re-ignite (brighten → inward) + co_recall synapses among co-read pairs.
for (const sess of RECALLS) {
  for (const k of sess.keys) {
    const e = byKey[k]
    if (e) e.recalledDaysAgo = Math.min(e.recalledDaysAgo, sess.daysAgo)
  }
  for (let i = 0; i < sess.keys.length; i++) {
    for (let j = i + 1; j < sess.keys.length; j++) {
      const pk = pairKey(sess.keys[i], sess.keys[j])
      const ex = edges.get(pk)
      if (ex) {
        ex.weight = Math.round(Math.min(SEM_CAP, ex.weight + 0.1) * 100) / 100
        ex.linkType = 'co_recall'
        ex.lastActivatedDaysAgo = Math.min(ex.lastActivatedDaysAgo, sess.daysAgo)
      } else {
        edges.set(pk, {
          a: sess.keys[i],
          b: sess.keys[j],
          weight: 0.5,
          linkType: 'co_recall',
          lastActivatedDaysAgo: sess.daysAgo,
        })
      }
    }
  }
}

// Assign demo-0NN ids by final recency (brightest/most-recent first), remap edge endpoints.
const ordered = [...entries].sort((a, b) => a.recalledDaysAgo - b.recalledDaysAgo)
const idOf = {}
ordered.forEach((e, i) => {
  idOf[e.key] = `demo-${String(i + 1).padStart(3, '0')}`
})

const fmtEntries = ordered
  .map((e) => {
    const b = e.body.replace(/'/g, "\\'")
    return `  { id: '${idOf[e.key]}', mood: Mood.${e.mood}, intensity: ${e.intensity}, daysAgo: ${e.recalledDaysAgo}, body: '${b}' },`
  })
  .join('\n')

const edgeList = [...edges.values()]
  .map((ed) => {
    const [a, b] = idOf[ed.a] < idOf[ed.b] ? [idOf[ed.a], idOf[ed.b]] : [idOf[ed.b], idOf[ed.a]]
    return { a, b, weight: ed.weight, linkType: ed.linkType, daysAgo: ed.lastActivatedDaysAgo }
  })
  .sort((p, q) => (p.a === q.a ? (p.b < q.b ? -1 : 1) : p.a < q.a ? -1 : 1))
const fmtEdges = edgeList
  .map(
    (ed) =>
      `  { a: '${ed.a}', b: '${ed.b}', weight: ${ed.weight}, linkType: '${ed.linkType}', daysAgo: ${ed.daysAgo} },`,
  )
  .join('\n')

console.log(`// ${entries.length} entries, ${edgeList.length} edges`)
console.log('export const DEMO_ENTRIES: DemoEntry[] = [')
console.log(fmtEntries)
console.log(']\n')
console.log('export const DEMO_EDGES: DemoEdge[] = [')
console.log(fmtEdges)
console.log(']')
