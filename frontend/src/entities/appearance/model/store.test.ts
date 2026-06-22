// 외형 store — 레거시 카탈로그 id 정규화(change 11). 제거된 id(nebula-heart·core·well·beam·flow)가
// 서버/영속에서 들어와도 크래시 없이 유효 기본값으로 폴백하고, 신규 카탈로그 id는 그대로 받는다(A12).
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

import { DEFAULT_SYNAPSE_STYLE } from '@/entities/synapse/@x/appearance'
import { DEFAULT_OBJECT } from '@/entities/star/@x/appearance'
import { useAppearance } from './store'
import { DEFAULT_SELF_OBJECT } from './self-objects'
import { DEFAULT_BACKGROUND } from './backgrounds'

describe('appearance store — change 11 카탈로그 정규화', () => {
  beforeEach(() => {
    // 알려진 유효 기준선으로 리셋(서버 = 커밋된 진실).
    useAppearance.getState().applyServerSettings({
      theme: DEFAULT_BACKGROUND,
      object: DEFAULT_OBJECT,
      selfObject: DEFAULT_SELF_OBJECT,
      synapseStyle: DEFAULT_SYNAPSE_STYLE,
      emotionColors: {},
    })
  })

  it('무료 기본값은 mirrorball / filament / vast / deepfield', () => {
    expect(DEFAULT_SELF_OBJECT).toBe('mirrorball')
    expect(DEFAULT_SYNAPSE_STYLE).toBe('filament')
    expect(DEFAULT_BACKGROUND).toBe('vast')
    expect(DEFAULT_OBJECT).toBe('deepfield')
  })

  it('레거시 self/synapse id는 무시되고 유효 현재값을 유지(크래시 없음)', () => {
    useAppearance.getState().applyServerSettings({
      selfObject: 'nebula-heart', // 제거됨 → 무시
      synapseStyle: 'beam', // 제거됨 → 무시
      theme: 'calm', // 유효 신규 → 수락
      object: 'pulsar', // 유효 신규 → 수락
      emotionColors: {},
    })
    const s = useAppearance.getState()
    expect(s.selfObject).toBe('mirrorball') // 레거시 nebula-heart 폴백
    expect(s.synapseStyle).toBe('filament') // 레거시 beam 폴백
    expect(s.theme).toBe('calm')
    expect(s.object).toBe('pulsar')
  })

  it('알 수 없는 4축 id는 현재 유효 선택을 유지한다', () => {
    useAppearance.getState().applyServerSettings({
      selfObject: 'prism-cube',
      synapseStyle: 'dendrite',
      theme: 'signal-noise',
      object: 'pulsar',
      emotionColors: {},
    })

    useAppearance.getState().applyServerSettings({
      selfObject: 'unknown-self',
      synapseStyle: 'unknown-synapse',
      theme: 'unknown-background',
      object: 'unknown-star',
      emotionColors: {},
    })

    const s = useAppearance.getState()
    expect(s.selfObject).toBe('prism-cube')
    expect(s.synapseStyle).toBe('dendrite')
    expect(s.theme).toBe('signal-noise')
    expect(s.object).toBe('pulsar')
  })

  it('신규 카탈로그 id(prism-cube·neuron-bloom·dendrite·signal-noise 등)는 그대로 수락', () => {
    useAppearance.getState().applyServerSettings({
      selfObject: 'prism-cube',
      synapseStyle: 'dendrite',
      theme: 'signal-noise',
      object: 'pulsar',
      emotionColors: {},
    })
    const s = useAppearance.getState()
    expect(s.selfObject).toBe('prism-cube')
    expect(s.synapseStyle).toBe('dendrite')
    expect(s.theme).toBe('signal-noise')

    useAppearance.getState().applyServerSettings({ selfObject: 'neuron-bloom', emotionColors: {} })
    expect(useAppearance.getState().selfObject).toBe('neuron-bloom')
  })
})
