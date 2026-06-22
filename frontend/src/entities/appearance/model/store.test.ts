// 외형 store — 형태×표면 합성 선택 정규화(spec 52). object/selfObject/synapseStyle은 합성 wire id
// "<form>+<surface>"를 운반하고, 레거시 단일 id(deepfield·pulsar·mirrorball·dendrite 등)와 미지 값은
// 정규화 경계에서 유효 합성으로 폴백한다(레거시는 프리셋 디컴포지션, 미지는 축 기본). 배경은 단일 id.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom + node-25 실험적 localStorage가 충돌해 bare `localStorage`의 setItem이 throw할 수 있다(persist
// 미들웨어가 store 생성 시점에 storage를 바인딩) → import 전(vi.hoisted)에 인메모리 스텁으로 교체한다.
vi.hoisted(() => {
  const mem = new Map<string, string>()
  const stub = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  } as Storage
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true, writable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: stub, configurable: true, writable: true })
  }
})

import { DEFAULT_SYNAPSE_SELECTION } from '@/entities/synapse/@x/appearance'
import { DEFAULT_STAR_SELECTION } from '@/entities/star/@x/appearance'
import { useAppearance } from './store'
import { DEFAULT_SELF_SELECTION } from './self-forms'
import { DEFAULT_BACKGROUND } from './backgrounds'

describe('appearance store — 형태×표면 합성 선택 정규화(spec 52)', () => {
  beforeEach(() => {
    // 알려진 유효 기준선으로 리셋(서버 = 커밋된 진실). 합성 기본값으로 시드한다.
    useAppearance.getState().applyServerSettings({
      theme: DEFAULT_BACKGROUND,
      object: DEFAULT_STAR_SELECTION,
      selfObject: DEFAULT_SELF_SELECTION,
      synapseStyle: DEFAULT_SYNAPSE_SELECTION,
      emotionColors: {},
    })
  })

  it('무료 기본 합성: lowpoly+facet / orb+mirror / strands+flow / galaxy', () => {
    expect(DEFAULT_STAR_SELECTION).toBe('lowpoly+facet')
    expect(DEFAULT_SELF_SELECTION).toBe('orb+mirror')
    expect(DEFAULT_SYNAPSE_SELECTION).toBe('strands+flow')
    expect(DEFAULT_BACKGROUND).toBe('galaxy')
  })

  it('레거시 단일 id는 (form, surface) 프리셋으로 디컴포지션된다', () => {
    useAppearance.getState().applyServerSettings({
      object: 'pulsar', // → smooth+pulse
      selfObject: 'prism-cube', // → cube+prism
      synapseStyle: 'dendrite', // → branched+flow
      theme: 'vortex', // 배경은 단일 id 그대로
      emotionColors: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('smooth+pulse')
    expect(s.selfObject).toBe('cube+prism')
    expect(s.synapseStyle).toBe('branched+flow')
    expect(s.theme).toBe('vortex')
  })

  it('합성 id는 그대로 라운드트립한다(form/surface 독립 조합)', () => {
    useAppearance.getState().applyServerSettings({
      object: 'octa+facet', // 다른 form에 무료 surface — 독립 조합
      selfObject: 'orb+neuron', // 무료 form에 유료 surface
      synapseStyle: 'dotted+beads',
      emotionColors: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('octa+facet')
    expect(s.selfObject).toBe('orb+neuron')
    expect(s.synapseStyle).toBe('dotted+beads')
  })

  it('미지 합성·sub-id는 축 기본 form/surface로 폴백한다(A9, 크래시 없음)', () => {
    useAppearance.getState().applyServerSettings({
      object: 'bogus+nope', // 양쪽 미지 → lowpoly+facet
      selfObject: 'orb+bogus', // surface만 미지 → orb+mirror
      synapseStyle: 'totally-unknown', // 합성 아님·레거시 아님 → strands+flow
      emotionColors: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('lowpoly+facet')
    expect(s.selfObject).toBe('orb+mirror')
    expect(s.synapseStyle).toBe('strands+flow')
  })

  it('한 슬롯만 바꾼 setObject는 다른 슬롯을 보존한다', () => {
    useAppearance.getState().setObject('octa+lava')
    expect(useAppearance.getState().object).toBe('octa+lava')
    // 미지 입력은 setObject도 정규화한다(기본 폴백).
    useAppearance.getState().setObject('garbage')
    expect(useAppearance.getState().object).toBe('lowpoly+facet')
  })
})
