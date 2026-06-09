import type { StarObject, StarObjectMeta } from './types'

/** 고를 수 있는 별 오브제 종류 — 노출 순서이자 단일 출처. */
export const STAR_OBJECTS: StarObjectMeta[] = [
  {
    id: 'deepfield',
    name: 'Crystal',
    tagline: '회절 스파이크 · 보석 결정',
    swatch: 'radial-gradient(circle at 62% 40%, #2a3a66 0%, #0a0e1e 55%, #030308 100%)',
  },
  {
    id: 'aurora',
    name: 'Nebula',
    tagline: '흐르는 빛구름',
    swatch: 'linear-gradient(135deg, #c7b6ff 0%, #8a7be6 35%, #ff9ec7 68%, #7fe0c6 100%)',
  },
  {
    id: 'liquid',
    name: 'Liquid',
    tagline: '굴절하는 액체 구슬',
    swatch: 'conic-gradient(from 210deg at 50% 50%, #ffb27a, #ff5fa0, #9b7bff, #5fd0c0, #ffb27a)',
  },
  {
    id: 'ember',
    name: 'Ember',
    tagline: '용암 균열 · 백열 코어',
    swatch: 'radial-gradient(circle at 38% 38%, #ef7a3a 0%, #5a2a14 45%, #0a0707 100%)',
  },
]

export const DEFAULT_OBJECT: StarObject = 'deepfield'
