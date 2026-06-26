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
      starFormByEmotion: {},
    })
  })

  it('무료 기본: 별 polyhedron(룩) / orb+mirror / strands+flow / galaxy', () => {
    expect(DEFAULT_STAR_SELECTION).toBe('polyhedron')
    expect(DEFAULT_SELF_SELECTION).toBe('orb+mirror')
    expect(DEFAULT_SYNAPSE_SELECTION).toBe('strands+flow')
    expect(DEFAULT_BACKGROUND).toBe('galaxy')
  })

  it('나·시냅스 레거시 단일 id는 (form, surface) 프리셋으로 디컴포지션, 별 레거시는 룩 디폴트로 폴백', () => {
    useAppearance.getState().applyServerSettings({
      object: 'pulsar', // 레거시 별 id → 룩 디폴트(polyhedron) 폴백(change 29: 호환 불필요)
      selfObject: 'prism-cube', // → cube+prism
      synapseStyle: 'dendrite', // → branched+flow
      theme: 'vortex', // 배경은 단일 id 그대로
      emotionColors: {},
      starFormByEmotion: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('polyhedron')
    expect(s.selfObject).toBe('cube+prism')
    expect(s.synapseStyle).toBe('branched+flow')
    expect(s.theme).toBe('vortex')
  })

  it('별 룩 id는 그대로 라운드트립, 나·시냅스 합성도 라운드트립', () => {
    useAppearance.getState().applyServerSettings({
      object: 'spiky', // 단일 축 룩
      selfObject: 'orb+neuron', // 무료 form에 유료 surface
      synapseStyle: 'dotted+beads',
      emotionColors: {},
      starFormByEmotion: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('spiky')
    expect(s.selfObject).toBe('orb+neuron')
    expect(s.synapseStyle).toBe('dotted+beads')
  })

  it('미지 값은 축 기본으로 폴백한다(A9, 크래시 없음)', () => {
    useAppearance.getState().applyServerSettings({
      object: 'bogus+nope', // 별: 미지 → polyhedron
      selfObject: 'orb+bogus', // surface만 미지 → orb+mirror
      synapseStyle: 'totally-unknown', // 합성 아님·레거시 아님 → strands+flow
      emotionColors: {},
      starFormByEmotion: {},
    })
    const s = useAppearance.getState()
    expect(s.object).toBe('polyhedron')
    expect(s.selfObject).toBe('orb+mirror')
    expect(s.synapseStyle).toBe('strands+flow')
  })

  it('setObject는 룩을 정규화한다(미지는 디폴트 폴백)', () => {
    useAppearance.getState().setObject('spiky')
    expect(useAppearance.getState().object).toBe('spiky')
    useAppearance.getState().setObject('garbage')
    expect(useAppearance.getState().object).toBe('polyhedron')
  })

  // change 30 — 감정별 별 형태 오버라이드(전역 기본 + per-mood).
  it('starFormByEmotion: 서버 시드 + 미지 룩 폴백(A5)', () => {
    useAppearance.getState().applyServerSettings({
      emotionColors: {},
      starFormByEmotion: { joy: 'spiky', sad: 'garbage' }, // 미지 룩 → 디폴트(polyhedron)로 정규화
    })
    const s = useAppearance.getState()
    expect(s.starFormByEmotion.joy).toBe('spiky')
    expect(s.starFormByEmotion.sad).toBe('polyhedron')
  })

  it('빈 맵 = 오버라이드 없음(전역 단일 룩과 동치)', () => {
    useAppearance.getState().applyServerSettings({ emotionColors: {}, starFormByEmotion: {} })
    expect(Object.keys(useAppearance.getState().starFormByEmotion)).toHaveLength(0)
  })

  it('setStarFormByEmotion은 룩을 정규화한다(미지는 디폴트 폴백)', () => {
    useAppearance.getState().setStarFormByEmotion('joy', 'liquid')
    expect(useAppearance.getState().starFormByEmotion.joy).toBe('liquid')
    useAppearance.getState().setStarFormByEmotion('sad', 'nope')
    expect(useAppearance.getState().starFormByEmotion.sad).toBe('polyhedron')
  })

  it('commit/revert가 감정별 룩 오버라이드를 드래프트로 다룬다', () => {
    useAppearance.getState().applyServerSettings({ emotionColors: {}, starFormByEmotion: {} }) // 빈 베이스라인
    useAppearance.getState().setStarFormByEmotion('joy', 'spiky') // 드래프트(미저장)
    expect(useAppearance.getState().starFormByEmotion.joy).toBe('spiky')
    expect(useAppearance.getState().savedSelection.starFormByEmotion.joy).toBeUndefined()
    useAppearance.getState().revertSelection() // 드래프트 폐기 → 베이스라인 복원
    expect(useAppearance.getState().starFormByEmotion.joy).toBeUndefined()
    useAppearance.getState().setStarFormByEmotion('joy', 'spiky')
    useAppearance.getState().commitSelection() // 저장 성공 후 기준선 확정
    expect(useAppearance.getState().savedSelection.starFormByEmotion.joy).toBe('spiky')
  })
})
