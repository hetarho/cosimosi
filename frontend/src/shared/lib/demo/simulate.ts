// 데모("체험") 우주 시뮬레이터 — 페르소나 일기 코퍼스(personas.ts)를 별·시냅스로 빚는다.
// 손으로 엣지를 그리지 않고, 실서버의 연결 규칙을 **조각(fragment) 단위**로 흉내 낸다:
//   • 다조각 일기 — 한 일기가 여러 장면(조각)으로 나뉘면 조각마다 별 하나. 조각끼리는 강한
//     일내 결속(intra_entry 0.8)으로 묶인다. 한 일기가 여러 주제를 담으면 그 결속선이 곧
//     주제 성단 사이의 다리가 된다(사용자 요구: "여기저기 연결된" 우주).
//   • 의미 링크 — 각 조각은 시간순으로 자기 이전 조각 중 topic-cosine 유사도 top-k에 잇는다.
//     weight = 0.42 + sim·0.4 + temporal_bonus, 상한 0.79(< intra 0.8). 사람-개체 주제를
//     공유하면 'entity', 아니면 'semantic'.
//   • 회상 세션 — 이 사람이 옛 별들을 다시 들춰본 사건. 그 일기 조각들을 재점화하고(밝아짐),
//     함께 읽은 서로 다른 주제의 일기끼리 co_recall 다리를 놓는다(주기적 회상 → 성단 가로지름).
//
// 순수 모듈 — three/React/DOM 미의존(헌법 §4). Mood는 proto enum 값을 그대로 통과시킨다.
import type { Mood } from '@/shared/api'

/** 코퍼스의 한 조각 = 한 별이 될 장면. topics가 유사도(성단)를, mood가 색을 정한다. */
export interface PersonaFragment {
  /** 영문 소문자 주제 태그 1~2개. 같은 태그끼리 모이고, 두 태그를 단 조각이 두 성단을 잇는다. */
  topics: string[]
  mood: Mood
  intensity: number
  text: string
}

/** 코퍼스의 한 일기 = N개 조각. 조각이 여럿이면 별 N개가 일내 결속으로 묶여 태어난다. */
export interface PersonaDiary {
  /** 페르소나 안에서 고유한 짧은 식별자(별 id 접두에 쓰인다). */
  key: string
  /** 그 일기를 쓴 '며칠 전'(작성일). 클수록 오래된 일기. */
  entryDaysAgo: number
  fragments: PersonaFragment[]
}

/** 회상 세션: 그날(daysAgo) 함께 다시 읽은 일기 key들 — 재점화 + 주제 가로지르는 co_recall. */
export interface PersonaRecall {
  daysAgo: number
  keys: string[]
}

/** 한 페르소나의 우주 원천 — 일기 흐름 + 회상 이력. 그래프(별·시냅스)는 simulate가 파생한다. */
export interface PersonaCorpus {
  id: string
  /** 스위처에 쓰는 이름(예: "20대 대학생"). */
  label: string
  /** 그 사람의 결을 담은 시적인 한 줄. */
  tagline: string
  diaries: PersonaDiary[]
  recalls: PersonaRecall[]
}

/** 시뮬레이션이 낸 한 별(= 한 조각). data.ts가 proto Star·Record로 파생한다. */
export interface SimStar {
  /** 별 id. 단일 조각 일기는 recordId와 같다(자기 id가 곧 record). */
  id: string
  /** 일기 단위 그룹 키(spec 28). 같은 일기의 조각은 이 값을 공유한다. */
  recordId: string
  fragmentIndex: number
  mood: Mood
  intensity: number
  /** 마지막 회상 경과일(밝기/잠듦을 좌우). 회상 세션이 줄여 놓는다. */
  daysAgo: number
  /** 일기 작성 경과일(record entry_date — 조각이 흩어져도 하나). */
  entryDaysAgo: number
  /** 원본 일기 본문(그 일기의 모든 조각 텍스트를 합친 것 — 모든 조각 별이 공유). */
  body: string
  /** 그 조각의 텍스트(별 → 조각, spec 28). 단일 조각 일기면 null(패널이 본문으로 폴백). */
  fragmentText: string | null
}

/** 시뮬레이션이 낸 한 시냅스. data.ts가 proto Synapse로 파생한다. */
export interface SimEdge {
  a: string
  b: string
  weight: number
  linkType: string
  /** 마지막 활성 경과일(밝기). 최근일수록 밝게 빛난다. */
  daysAgo: number
}

export interface SimUniverse {
  stars: SimStar[]
  edges: SimEdge[]
}

// 연결 규칙 상수 — 실서버 worker.go(KNN·temporal·weight cap)와 같은 결의 데모 근사.
const KNN_K = 5 // 한 조각이 이을 수 있는 의미 이웃 top-k
const SIM_TAU = 0.4 // 이웃 자격을 얻는 유사도 바닥(topic-cosine)
const SEM_CAP = 0.79 // 일기 간 의미 weight 상한(< intra 0.8)
const INTRA_WEIGHT = 0.8 // 같은 일기 조각끼리의 고정 결속
const TEMPORAL_DAYS = 7 // 같은 주(週) temporal 보너스 창
const TEMPORAL_MAX = 0.3
const CO_RECALL_BUMP = 0.1 // 회상이 기존 선을 더하는 양
const CO_RECALL_BASE = 0.5 // 회상이 처음 놓는 다리의 weight

// 사람·개체 주제 — 두 조각이 이 중 하나를 공유하면 'entity' 링크(관계의 별자리).
const ENTITY_TOPICS = new Set([
  'love',
  'friend',
  'family',
  'children',
  'husband',
  'partner',
  'colleague',
  'parents',
  'pet',
])

const round2 = (n: number): number => Math.round(n * 100) / 100
const order = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x])
const pairKey = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`)

interface WorkFragment {
  id: string
  recordId: string
  fragmentIndex: number
  diaryKey: string
  topics: string[]
  mood: Mood
  intensity: number
  text: string
  body: string
  fragmentText: string | null
  entryDaysAgo: number
  recalledDaysAgo: number
}

/** topic 집합 위 코사인(임베딩 유사도의 대역). 공유 주제가 많을수록 1에 가깝다. */
function topicCosine(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let shared = 0
  for (const t of a) if (b.includes(t)) shared += 1
  return shared / Math.sqrt(a.length * b.length)
}

function sim(a: WorkFragment, b: WorkFragment): number {
  return topicCosine(a.topics, b.topics)
}

function temporalBonus(a: WorkFragment, b: WorkFragment): number {
  const d = Math.abs(a.entryDaysAgo - b.entryDaysAgo)
  if (d >= TEMPORAL_DAYS) return 0
  return TEMPORAL_MAX * (1 - d / TEMPORAL_DAYS)
}

function entityShared(a: WorkFragment, b: WorkFragment): boolean {
  return a.topics.some((t) => ENTITY_TOPICS.has(t) && b.topics.includes(t))
}

/** 페르소나 코퍼스 → 별·시냅스 우주. 결정론적(난수 없음) — 같은 코퍼스면 늘 같은 그래프. */
export function simulate(corpus: PersonaCorpus): SimUniverse {
  // ── 조각 펼치기: 일기마다 별 id를 박고 본문을 합친다 ──
  const frags: WorkFragment[] = []
  const byDiaryKey = new Map<string, WorkFragment[]>()
  for (const d of corpus.diaries) {
    const recordId = `${corpus.id}-${d.key}`
    const body = d.fragments.map((f) => f.text).join('\n\n')
    const single = d.fragments.length === 1
    const list = d.fragments.map((fr, i) => ({
      id: single ? recordId : `${recordId}-f${i}`,
      recordId,
      fragmentIndex: i,
      diaryKey: d.key,
      topics: fr.topics,
      mood: fr.mood,
      intensity: fr.intensity,
      text: fr.text,
      body,
      fragmentText: single ? null : fr.text,
      entryDaysAgo: d.entryDaysAgo,
      recalledDaysAgo: d.entryDaysAgo,
    }))
    frags.push(...list)
    byDiaryKey.set(d.key, list)
  }

  const edges = new Map<string, SimEdge>()

  // ① 일내 결속(intra_entry): 같은 일기 조각의 모든 쌍을 강한 고정 weight로 — 성단 사이 다리.
  for (const list of byDiaryKey.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let k = i + 1; k < list.length; k++) {
        const [a, b] = order(list[i].id, list[k].id)
        edges.set(pairKey(a, b), {
          a,
          b,
          weight: INTRA_WEIGHT,
          linkType: 'intra_entry',
          daysAgo: list[i].entryDaysAgo,
        })
      }
    }
  }

  // ② 의미 링크: 시간순(오래된→최신), 각 조각이 자기 이전 조각 중 유사도 top-k에 잇는다.
  const chrono = [...frags].sort((a, b) => b.entryDaysAgo - a.entryDaysAgo) // 오래된 것 먼저
  for (let i = 0; i < chrono.length; i++) {
    const self = chrono[i]
    const cands: { other: WorkFragment; s: number }[] = []
    for (let j = 0; j < i; j++) {
      const other = chrono[j]
      if (other.diaryKey === self.diaryKey) continue // 같은 일기는 이미 intra_entry
      const s = sim(self, other)
      if (s >= SIM_TAU) cands.push({ other, s })
    }
    cands.sort((p, q) => q.s - p.s || temporalBonus(self, q.other) - temporalBonus(self, p.other))
    for (const { other, s } of cands.slice(0, KNN_K)) {
      const [a, b] = order(self.id, other.id)
      const pk = pairKey(a, b)
      if (edges.has(pk)) continue // 이미 (일내/먼저 생긴) 선이 있으면 둔다
      const w = Math.min(SEM_CAP, 0.42 + s * 0.4 + temporalBonus(self, other))
      edges.set(pk, {
        a,
        b,
        weight: round2(w),
        linkType: entityShared(self, other) ? 'entity' : 'semantic',
        daysAgo: Math.min(self.entryDaysAgo, other.entryDaysAgo),
      })
    }
  }

  // ③ 회상 세션: 그 일기 조각들을 재점화(밝아짐→안쪽)하고, 함께 읽은 다른 주제 일기끼리 다리.
  for (const sess of corpus.recalls) {
    const sessFrags = sess.keys.flatMap((k) => byDiaryKey.get(k) ?? [])
    for (const f of sessFrags) f.recalledDaysAgo = Math.min(f.recalledDaysAgo, sess.daysAgo)
    // 다시 읽은 일기 안의 일내 선도 함께 활성(밝기 갱신).
    for (const k of sess.keys) {
      const list = byDiaryKey.get(k) ?? []
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const ex = edges.get(pairKey(list[i].id, list[j].id))
          if (ex) ex.daysAgo = Math.min(ex.daysAgo, sess.daysAgo)
        }
      }
    }
    // 일기 간 co_recall 다리: 각 일기의 대표 조각(첫 조각)끼리 — 주제가 다르면 성단을 잇는다.
    // 같은 세션에 한 일기가 중복돼도 자기 자신과 잇지 않게 key를 한 번만 센다.
    const reps = [...new Set(sess.keys)]
      .map((k) => (byDiaryKey.get(k) ?? [])[0])
      .filter(Boolean) as WorkFragment[]
    for (let i = 0; i < reps.length; i++) {
      for (let k = i + 1; k < reps.length; k++) {
        const [a, b] = order(reps[i].id, reps[k].id)
        const pk = pairKey(a, b)
        const ex = edges.get(pk)
        if (ex) {
          ex.weight = round2(Math.min(SEM_CAP, ex.weight + CO_RECALL_BUMP))
          ex.linkType = 'co_recall'
          ex.daysAgo = Math.min(ex.daysAgo, sess.daysAgo)
        } else {
          edges.set(pk, {
            a,
            b,
            weight: CO_RECALL_BASE,
            linkType: 'co_recall',
            daysAgo: sess.daysAgo,
          })
        }
      }
    }
  }

  // ④ 연결성 보장: 어떤 일기도 우주에서 고립되지 않게 한다("여기저기 연결된 우주" 요구의 불변).
  // 다른 일기와 잇는 선이 하나도 없는 일기는 시간순 이웃(직전=더 최근 일기)의 첫 조각에 약한
  // 의미 다리를 놓는다. 현 코퍼스는 모두 이미 연결돼 있어 한 줄도 추가되지 않고(출력 불변), 이후
  // JSON을 손봐 외톨이 일기가 생겨도 우주가 한 덩어리로 남게 하는 안전망이다.
  const diaryKeyById = new Map(frags.map((f) => [f.id, f.diaryKey]))
  const linkedOut = new Set<string>()
  for (const e of edges.values()) {
    const da = diaryKeyById.get(e.a)
    const db = diaryKeyById.get(e.b)
    if (da && db && da !== db) {
      linkedOut.add(da)
      linkedOut.add(db)
    }
  }
  const byRecency = [...corpus.diaries].sort((a, b) => a.entryDaysAgo - b.entryDaysAgo)
  for (let i = 0; i < byRecency.length; i++) {
    const d = byRecency[i]
    if (linkedOut.has(d.key)) continue
    const neighbor = byRecency[i - 1] ?? byRecency[i + 1]
    const self = (byDiaryKey.get(d.key) ?? [])[0]
    const nb = neighbor ? (byDiaryKey.get(neighbor.key) ?? [])[0] : undefined
    if (!self || !nb) continue
    const [a, b] = order(self.id, nb.id)
    const pk = pairKey(a, b)
    if (!edges.has(pk)) {
      edges.set(pk, {
        a,
        b,
        weight: CO_RECALL_BASE,
        linkType: 'semantic',
        daysAgo: Math.min(self.entryDaysAgo, nb.entryDaysAgo),
      })
    }
  }

  const stars: SimStar[] = frags.map((f) => ({
    id: f.id,
    recordId: f.recordId,
    fragmentIndex: f.fragmentIndex,
    mood: f.mood,
    intensity: f.intensity,
    daysAgo: f.recalledDaysAgo,
    entryDaysAgo: f.entryDaysAgo,
    body: f.body,
    fragmentText: f.fragmentText,
  }))

  return { stars, edges: [...edges.values()] }
}

/** 한 페르소나의 조각을 {id, topics, intensity}로 펼친다(crossResonances 입력 — 별 id 규약은 simulate와 동일). */
function flattenFragments(c: PersonaCorpus): { id: string; topics: string[]; intensity: number }[] {
  return c.diaries.flatMap((d) => {
    const recordId = `${c.id}-${d.key}`
    const single = d.fragments.length === 1
    return d.fragments.map((f, i) => ({
      id: single ? recordId : `${recordId}-f${i}`,
      topics: f.topics,
      intensity: f.intensity,
    }))
  })
}

/** 두 우주 사이의 *공명 쌍*(spec 37 데모): 서로 다른 두 삶에서 주제가 가장 닿는 기억끼리 잇는다 —
 *  데모엔 별 보내기/수락(gift) 흐름이 없으므로(서버 없음) "이미 공명된 두 우주"를 코퍼스에서 파생한다.
 *  페르소나 내부 simulate의 의미 링크와 같은 topic-cosine을 두 코퍼스 *사이*에 적용하고, 강도가 센
 *  쌍을 살짝 우대해 1:1 매칭으로 최대 max쌍을 고른다(각 별은 한 다리에만 — 시각적으로 또렷하게).
 *  결정론적(난수 없음) — 같은 두 코퍼스면 늘 같은 다리. aId는 a 우주, bId는 b 우주의 별 id. */
export function crossResonances(
  a: PersonaCorpus,
  b: PersonaCorpus,
  max = 4,
): { aId: string; bId: string }[] {
  const fa = flattenFragments(a)
  const fb = flattenFragments(b)
  const cands: { aId: string; bId: string; s: number }[] = []
  for (const x of fa) {
    for (const y of fb) {
      const cos = topicCosine(x.topics, y.topics)
      if (cos >= SIM_TAU) cands.push({ aId: x.id, bId: y.id, s: cos + (x.intensity + y.intensity) * 0.05 })
    }
  }
  cands.sort((p, q) => q.s - p.s || (p.aId < q.aId ? -1 : 1)) // 점수 desc, 동점은 id로 안정 정렬
  const usedA = new Set<string>()
  const usedB = new Set<string>()
  const out: { aId: string; bId: string }[] = []
  for (const c of cands) {
    if (out.length >= max) break
    if (usedA.has(c.aId) || usedB.has(c.bId)) continue // 1:1 매칭 — 한 별은 한 다리에만
    usedA.add(c.aId)
    usedB.add(c.bId)
    out.push({ aId: c.aId, bId: c.bId })
  }
  return out
}
