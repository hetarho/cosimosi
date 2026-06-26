import { describe, expect, it } from 'vitest'
import { simulate } from './simulate'
import { CORPORA, PERSONA_ORDER, demoPersonaList } from './personas'

// 페르소나 우주가 사용자 요구를 만족하는지 데이터 차원에서 고정한다:
//  ① 일기 1개 → 별 N개(다조각이 기본), ② 성단 사이 다리로 우주가 한 덩어리로 연결,
//  ③ 모든 엣지가 실재 별을 가리키고 무방향 규약(a<b)을 지킨다.
describe('persona universe simulation', () => {
  for (const id of PERSONA_ORDER) {
    const corpus = CORPORA[id]

    describe(`${id} (${corpus.label})`, () => {
      const uni = simulate(corpus)
      const ids = new Set(uni.stars.map((s) => s.id))

      it('한 일기가 여러 별로 — 다조각이 기본(평균 조각 > 1.3)', () => {
        const avg = uni.stars.length / corpus.diaries.length
        expect(avg).toBeGreaterThan(1.3)
        // 다조각 일기의 조각은 recordId를 공유하고 fragment_text가 있다.
        const multi = uni.stars.filter((s) => s.fragmentText != null)
        expect(multi.length).toBeGreaterThan(0)
        for (const s of multi) expect(s.recordId).not.toBe(s.id)
      })

      it('모든 엣지가 실재 별을 무방향(a<b)으로 가리킨다', () => {
        for (const e of uni.edges) {
          expect(ids.has(e.a)).toBe(true)
          expect(ids.has(e.b)).toBe(true)
          expect(e.a < e.b).toBe(true)
          expect(e.weight).toBeGreaterThan(0)
          expect(e.weight).toBeLessThanOrEqual(0.8)
        }
      })

      it('일내 결속(intra_entry)과 성단 사이 다리가 있다', () => {
        const intra = uni.edges.filter((e) => e.linkType === 'intra_entry')
        expect(intra.length).toBeGreaterThan(0)
        // 토픽이 전혀 겹치지 않는 두 별을 잇는 엣지 = 성단 사이 다리.
        const topicOf = new Map(
          uni.stars.flatMap((s) => {
            const d = corpus.diaries.find((x) => `${corpus.id}-${x.key}` === s.recordId)
            const f = d?.fragments[s.fragmentIndex]
            return f ? [[s.id, new Set(f.topics)] as const] : []
          }),
        )
        const bridges = uni.edges.filter((e) => {
          const ta = topicOf.get(e.a)
          const tb = topicOf.get(e.b)
          if (!ta || !tb) return false
          return ![...ta].some((t) => tb.has(t))
        })
        expect(bridges.length).toBeGreaterThan(0)
      })

      it('우주가 한 덩어리로 연결된다(고립 성단 없음)', () => {
        const adj = new Map<string, string[]>(uni.stars.map((s) => [s.id, []]))
        for (const e of uni.edges) {
          adj.get(e.a)?.push(e.b)
          adj.get(e.b)?.push(e.a)
        }
        const seen = new Set<string>()
        const stack = [uni.stars[0].id]
        seen.add(uni.stars[0].id)
        while (stack.length) {
          const cur = stack.pop() as string
          for (const n of adj.get(cur) ?? []) {
            if (!seen.has(n)) {
              seen.add(n)
              stack.push(n)
            }
          }
        }
        expect(seen.size).toBe(uni.stars.length)
      })

      it('결정론적 — 같은 코퍼스는 늘 같은 그래프', () => {
        const again = simulate(corpus)
        expect(again.stars.length).toBe(uni.stars.length)
        expect(again.edges.length).toBe(uni.edges.length)
      })
    })
  }

  it('스위처 메타는 세 페르소나의 라벨·태그라인을 제공한다', () => {
    const list = demoPersonaList()
    expect(list.map((p) => p.id)).toEqual(PERSONA_ORDER)
    for (const p of list) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.tagline.length).toBeGreaterThan(0)
    }
  })
})
