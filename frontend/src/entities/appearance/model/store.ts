// 앱 전역 시각 설정 store(spec 30·44). 4축 선택(배경=theme·별=object·나=selfObject·시냅스=synapseStyle)은
// *기기* 선호라 localStorage에 지속한다. 감정색 오버라이드(emotionColors)와 **별가루 잔액·소유권**은
// per-user 자산이라 메모리에만 둔다(공용 PC에 개인 데이터·자산 영속 금지 — domain/data-sync + spec 44).
// 인증 세션이면 GetSettings·GetInventory로 시드되고, 로그아웃·계정 전환·체험 전환 시 출처 리셋이 비운다.
// 위치 근거: object(StarObject)·synapseStyle(SynapseStyle)가 도메인-비주얼이라 4축을 한 묶음으로 여기 둔다.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type StarObject, STAR_OBJECTS, DEFAULT_OBJECT } from '@/entities/star/@x/appearance'
import {
  type SynapseStyle,
  SYNAPSE_STYLES,
  DEFAULT_SYNAPSE_STYLE,
} from '@/entities/synapse/@x/appearance'
import { priceOf } from '@/shared/config'
import type { Background, SelfObject } from './types'
import { BACKGROUNDS, DEFAULT_BACKGROUND } from './backgrounds'
import { SELF_OBJECTS, DEFAULT_SELF_OBJECT } from './self-objects'

const THEME_IDS = new Set<Background>(BACKGROUNDS.map((b) => b.id))
const OBJECT_IDS = new Set<StarObject>(STAR_OBJECTS.map((o) => o.id))
const SELF_OBJECT_IDS = new Set<SelfObject>(SELF_OBJECTS.map((o) => o.id))
const SYNAPSE_STYLE_IDS = new Set<SynapseStyle>(SYNAPSE_STYLES.map((s) => s.id))

const STORAGE_KEY = 'cosimosi.appearance'
const LEGACY_KEY = 'cosimosi.landing.theme' // 레거시 마이그레이션용 구 저장 키

/** 서버가 내려준 시각 오버라이드(spec 30·44). 4축 선택 중 빈 값은 기존(기본)을 유지하고,
 *  emotionColors는 사용자가 바꾼 mood만 담는다(빈 맵 = 전부 기본 팔레트). */
export interface ServerAppearance {
  theme?: string
  object?: string
  selfObject?: string
  synapseStyle?: string
  emotionColors: Record<string, string>
}

/** GetInventory 결과(서버 권위 자산) — 잔액 + 소유한 유료 아이템 id. */
export interface ServerInventory {
  stardust: number
  ownedItemIds: string[]
}

/** 커밋된 4축 선택 스냅샷(저장 기준선). 라이브 선택이 이것과 다르면 "미저장(드래프트)"이다 — 홈
 *  편집기는 라이브를 미리보기로 바꾸고, 플로팅 저장 버튼이 차이를 커밋한다(spec 44). */
export interface SelectionSnapshot {
  theme: Background
  object: StarObject
  selfObject: SelfObject
  synapseStyle: SynapseStyle
}

interface AppearanceState {
  theme: Background
  object: StarObject
  /** 중심 "나" 별의 형태(spec 38·44). 서버 동기 선택 축(나). */
  selfObject: SelfObject
  /** 시냅스 연결선 스타일(spec 44). 서버 동기 선택 축(시냅스). */
  synapseStyle: SynapseStyle
  /** mood(소문자) → "#RRGGBB" 사용자 오버라이드. 서버 시드·메모리 전용. 빈 맵 = 전부 기본 팔레트. */
  emotionColors: Record<string, string>
  /** 별가루 잔액(spec 44). 서버 권위·메모리 전용(영속 금지). 시드 전엔 0. */
  stardust: number
  /** 소유한 유료 아이템 id 집합(spec 44). 무료 종은 묵시 소유라 여기 없다. 메모리 전용. */
  ownedItemIds: Set<string>
  /** 마지막으로 커밋(저장)된 4축 선택 — 라이브 선택과 다르면 드래프트(미저장)다(spec 44). 서버 시드·저장에서
   *  갱신된다. 홈 편집기는 라이브를 미리보기로만 바꾸고, 저장 시 commitSelection으로 여기에 확정한다. */
  savedSelection: SelectionSnapshot
  setTheme: (id: Background) => void
  setObject: (id: StarObject) => void
  setSelfObject: (id: SelfObject) => void
  setSynapseStyle: (id: SynapseStyle) => void
  setEmotionColor: (mood: string, color: string) => void
  /** GetSettings 응답(오버라이드만)을 store에 머지 — 인증 세션에서 서버가 단일 진실(4축). */
  applyServerSettings: (s: ServerAppearance) => void
  /** GetInventory 응답을 store에 적용(잔액·소유권 = 서버 권위). */
  applyInventory: (inv: ServerInventory) => void
  /** 구매 낙관적 반영(잔액 차감 + 소유 추가). 반환된 revert()로 RPC 실패 시 되돌린다(A2/A3). */
  purchaseItem: (itemId: string) => () => void
  /** 현재 라이브 4축 선택을 저장 기준선(savedSelection)으로 확정 — 저장 성공 후 호출(드래프트 종료). */
  commitSelection: () => void
  /** 라이브 4축 선택을 저장 기준선으로 되돌린다(드래프트 폐기/되돌리기). */
  revertSelection: () => void
  /** 출처 경계 리셋(로그아웃·계정 전환·체험 전환): per-user 감정색·지갑·소유권을 비운다. */
  resetServerSettings: () => void
}

/**
 * 구 키(cosimosi.landing.theme)에서 1회 승계한다. 구 저장본은 {theme:'deepfield'|...}로
 * 색+형태를 함께 담았고 그 값이 StarObject id(deepfield/aurora/liquid/ember)와 같으므로,
 * theme이 그 4-값이면 object로 승계하고 theme은 vast로 폴백한다.
 * 새 키가 이미 있으면 건드리지 않는다.
 */
function legacyInitial(): { theme: Background; object: StarObject } {
  const base = { theme: DEFAULT_BACKGROUND, object: DEFAULT_OBJECT }
  try {
    if (typeof localStorage === 'undefined') return base
    if (localStorage.getItem(STORAGE_KEY)) return base
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return base
    const s = (JSON.parse(raw)?.state ?? {}) as { theme?: string; object?: string }
    const theme = s.theme && THEME_IDS.has(s.theme as Background) ? (s.theme as Background) : DEFAULT_BACKGROUND
    const object =
      s.object && OBJECT_IDS.has(s.object as StarObject)
        ? (s.object as StarObject)
        : s.theme && OBJECT_IDS.has(s.theme as StarObject)
          ? (s.theme as StarObject)
          : DEFAULT_OBJECT
    return { theme, object }
  } catch {
    return base
  }
}

/** localStorage 지속(키: cosimosi.appearance) — 단 기기 선호(4축 선택)만. 자산(별가루·소유권)은 절대 안 함. */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set, get) => {
      const init = legacyInitial()
      return {
      theme: init.theme,
      object: init.object,
      selfObject: DEFAULT_SELF_OBJECT,
      synapseStyle: DEFAULT_SYNAPSE_STYLE,
      savedSelection: {
        theme: init.theme,
        object: init.object,
        selfObject: DEFAULT_SELF_OBJECT,
        synapseStyle: DEFAULT_SYNAPSE_STYLE,
      },
      emotionColors: {},
      stardust: 0,
      ownedItemIds: new Set<string>(),
      setTheme: (id) => set({ theme: id }),
      setObject: (id) => set({ object: id }),
      setSelfObject: (id) => set({ selfObject: id }),
      setSynapseStyle: (id) => set({ synapseStyle: id }),
      setEmotionColor: (mood, color) =>
        set((s) => ({ emotionColors: { ...s.emotionColors, [mood]: color } })),
      applyServerSettings: (sv) =>
        set((s) => {
          // 서버 = 커밋된 진실: 4축을 해석해 라이브 선택과 savedSelection(저장 기준선) 둘 다에 반영한다 →
          // 서버 시드 직후엔 드래프트(미저장)가 없다(dirty=false). 저장은 이 응답으로 재동기화된다.
          const theme = sv.theme && THEME_IDS.has(sv.theme as Background) ? (sv.theme as Background) : s.theme
          const object =
            sv.object && OBJECT_IDS.has(sv.object as StarObject) ? (sv.object as StarObject) : s.object
          const selfObject =
            sv.selfObject && SELF_OBJECT_IDS.has(sv.selfObject as SelfObject)
              ? (sv.selfObject as SelfObject)
              : s.selfObject
          const synapseStyle =
            sv.synapseStyle && SYNAPSE_STYLE_IDS.has(sv.synapseStyle as SynapseStyle)
              ? (sv.synapseStyle as SynapseStyle)
              : s.synapseStyle
          // 색 내용이 그대로면 참조를 유지 — 4축만 바뀐 쓰기/재시드에서 별·시냅스 색
          // 전체 재베이킹(StarField aMood·UniverseSynapses colById)을 피한다.
          const keys = Object.keys(sv.emotionColors)
          const sameColors =
            keys.length === Object.keys(s.emotionColors).length &&
            keys.every((k) => sv.emotionColors[k] === s.emotionColors[k])
          return {
            theme,
            object,
            selfObject,
            synapseStyle,
            savedSelection: { theme, object, selfObject, synapseStyle },
            emotionColors: sameColors ? s.emotionColors : sv.emotionColors,
          }
        }),
      applyInventory: (inv) => set({ stardust: inv.stardust, ownedItemIds: new Set(inv.ownedItemIds) }),
      purchaseItem: (itemId) => {
        const prev = get()
        const prevStardust = prev.stardust
        const prevOwned = prev.ownedItemIds
        const price = priceOf(itemId) ?? 0
        const nextOwned = new Set(prevOwned)
        nextOwned.add(itemId)
        // 낙관적: 잔액 차감(0 바닥 — 음수 금지, A3) + 소유 추가. RPC 응답이 권위로 덮어쓴다.
        set({ stardust: Math.max(0, prevStardust - price), ownedItemIds: nextOwned })
        return () => set({ stardust: prevStardust, ownedItemIds: prevOwned })
      },
      commitSelection: () =>
        set((s) => ({
          savedSelection: {
            theme: s.theme,
            object: s.object,
            selfObject: s.selfObject,
            synapseStyle: s.synapseStyle,
          },
        })),
      revertSelection: () =>
        set((s) => ({
          theme: s.savedSelection.theme,
          object: s.savedSelection.object,
          selfObject: s.savedSelection.selfObject,
          synapseStyle: s.savedSelection.synapseStyle,
        })),
      resetServerSettings: () =>
        set({ emotionColors: {}, stardust: 0, ownedItemIds: new Set<string>() }),
      }
    },
    {
      name: STORAGE_KEY,
      // 기기 선호(4축 선택)만 영속 — emotionColors·별가루·소유권은 per-user라 메모리 전용(공용 PC 자산 미영속).
      partialize: (s) => ({
        theme: s.theme,
        object: s.object,
        selfObject: s.selfObject,
        synapseStyle: s.synapseStyle,
      }),
      // 알 수 없는/손상된 값이 저장돼 있어도 각 축의 기본값으로 폴백. 하이드레이트된 라이브 선택을
      // savedSelection에도 그대로 실어 로드 직후엔 드래프트(미저장)가 없게 한다 — 이후 서버 시드가
      // 인증 사용자의 진실로 둘 다 덮어쓴다(applyServerSettings).
      merge: (persisted, current) => {
        const p = persisted as Partial<AppearanceState> | undefined
        const theme = p?.theme && THEME_IDS.has(p.theme) ? p.theme : current.theme
        const object = p?.object && OBJECT_IDS.has(p.object) ? p.object : current.object
        const selfObject =
          p?.selfObject && SELF_OBJECT_IDS.has(p.selfObject) ? p.selfObject : current.selfObject
        const synapseStyle =
          p?.synapseStyle && SYNAPSE_STYLE_IDS.has(p.synapseStyle)
            ? p.synapseStyle
            : current.synapseStyle
        return {
          ...current,
          theme,
          object,
          selfObject,
          synapseStyle,
          savedSelection: { theme, object, selfObject, synapseStyle },
        }
      },
    },
  ),
)
