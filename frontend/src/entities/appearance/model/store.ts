// 앱 전역 시각 설정 store(spec 30·44·52·53). 4축 선택(배경=theme·별=object·나=selfObject·시냅스=synapseStyle)은
// *기기* 선호라 localStorage에 지속한다. 배경·별은 단일 id(별=룩 id, change 29), 나·시냅스는 형태×표면 합성 id
// "<form>+<surface>"(spec 52) — wire 필드 이름·proto·DB는 그대로다. 정규화(normalizeXSelection)가 합성·레거시·
// 미지를 전부 유효 선택으로 폴백한다(A9). 감정색 오버라이드(emotionColors)·감정별 형태 오버라이드
// (starFormByEmotion, change 30)와 **별가루 잔액·소유권**은 per-user 자산이라 메모리에만 둔다(공용 PC에
// 개인 데이터·자산 영속 금지 — domain/data-sync + spec 44). 단 형태 오버라이드는 4축 드래프트와 함께 저장된다.
// 인증 세션이면 GetSettings·GetInventory로 시드되고, 로그아웃·계정 전환·체험 전환 시 출처 리셋이 비운다.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_STAR_SELECTION, normalizeStarLook } from '@/entities/star/@x/appearance'
import {
  DEFAULT_SYNAPSE_SELECTION,
  normalizeSynapseSelection,
} from '@/entities/synapse/@x/appearance'
import { priceOf } from '@/shared/config'
import type { Background } from './types'
import { DEFAULT_BACKGROUND, parseBackground } from './backgrounds'
import { DEFAULT_SELF_SELECTION, normalizeSelfSelection } from './self-forms'

const STORAGE_KEY = 'cosimosi.appearance'
const LEGACY_KEY = 'cosimosi.landing.theme' // 레거시 마이그레이션용 구 저장 키

/** 서버가 내려준 시각 오버라이드(spec 30·44). 4축 선택 중 빈 값은 기존(기본)을 유지하고,
 *  emotionColors는 사용자가 바꾼 mood만 담는다(빈 맵 = 전부 기본 팔레트). object/selfObject/synapseStyle은
 *  합성 wire id(또는 레거시 단일 id) 문자열 — 정규화 경계가 유효 합성으로 폴백한다. starFormByEmotion은
 *  사용자가 별 룩을 오버라이드한 mood만 담는다(빈 맵 = 전부 전역 기본 룩, change 30). */
export interface ServerAppearance {
  theme?: string
  object?: string
  selfObject?: string
  synapseStyle?: string
  emotionColors: Record<string, string>
  starFormByEmotion: Record<string, string>
}

/** GetInventory 결과(서버 권위 자산) — 잔액 + 소유한 유료 아이템 id. */
export interface ServerInventory {
  stardust: number
  ownedItemIds: string[]
}

/** 커밋된 4축 선택 스냅샷(저장 기준선). 라이브 선택이 이것과 다르면 "미저장(드래프트)"이다 — 홈
 *  편집기는 라이브를 미리보기로 바꾸고, 플로팅 저장 버튼이 차이를 커밋한다(spec 44). 별·나·시냅스는 합성 id. */
export interface SelectionSnapshot {
  theme: Background
  object: string
  selfObject: string
  synapseStyle: string
  /** 감정별 별 룩 오버라이드(mood→look). 4축 선택과 함께 저장 바가 커밋한다(change 30). 빈 맵 = 전부 전역 기본. */
  starFormByEmotion: Record<string, string>
}

interface AppearanceState {
  theme: Background
  /** 별 스킨 합성 선택 "<form>+<surface>"(spec 52). 서버 동기 선택 축(별). */
  object: string
  /** 중심 "나" 별의 합성 선택(spec 38·52). 서버 동기 선택 축(나). */
  selfObject: string
  /** 시냅스 연결선 합성 선택(spec 52). 서버 동기 선택 축(시냅스). */
  synapseStyle: string
  /** mood(소문자) → "#RRGGBB" 사용자 오버라이드. 서버 시드·메모리 전용. 빈 맵 = 전부 기본 팔레트. */
  emotionColors: Record<string, string>
  /** mood(소문자) → 별 룩 id 사용자 오버라이드(change 30). 빈 맵 = 전부 전역 기본 룩(object). 서버 시드·
   *  메모리 전용. 색과 달리 4축 드래프트(savedSelection)에 실려 저장 바가 함께 커밋한다(스위처에서 편집). */
  starFormByEmotion: Record<string, string>
  /** 별가루 잔액(spec 44). 서버 권위·메모리 전용(영속 금지). 시드 전엔 0. */
  stardust: number
  /** 소유한 유료 아이템 id 집합(spec 44). 무료 종은 묵시 소유라 여기 없다. 메모리 전용. */
  ownedItemIds: Set<string>
  /** 마지막으로 커밋(저장)된 4축 선택 — 라이브 선택과 다르면 드래프트(미저장)다(spec 44). 서버 시드·저장에서
   *  갱신된다. 홈 편집기는 라이브를 미리보기로만 바꾸고, 저장 시 commitSelection으로 여기에 확정한다. */
  savedSelection: SelectionSnapshot
  setTheme: (id: Background) => void
  /** 별 합성 선택을 정규화해 설정(form·surface 어느 한쪽만 바꾸려면 호출자가 합성 id를 만들어 넘긴다). */
  setObject: (id: string) => void
  setSelfObject: (id: string) => void
  setSynapseStyle: (id: string) => void
  setEmotionColor: (mood: string, color: string) => void
  /** 한 감정의 별 룩 오버라이드를 설정(정규화)(change 30). 스위처의 감정-대상 드롭다운이 호출한다. */
  setStarFormByEmotion: (mood: string, look: string) => void
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
 * 구 키(cosimosi.landing.theme)에서 1회 승계한다. 구 저장본은 {theme:'deepfield'|...}로 색+형태를 함께
 * 담았으나, 별 형태는 이제 단일 축 룩이라(change 29) 레거시 값은 normalizeStarLook이 디폴트 룩으로 폴백하고
 * theme은 배경으로 폴백한다. 새 키가 이미 있으면 건드리지 않는다.
 */
function legacyInitial(): { theme: Background; object: string } {
  const base = { theme: DEFAULT_BACKGROUND, object: DEFAULT_STAR_SELECTION }
  try {
    if (typeof localStorage === 'undefined') return base
    if (localStorage.getItem(STORAGE_KEY)) return base
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return base
    const s = (JSON.parse(raw)?.state ?? {}) as { theme?: string; object?: string }
    const theme = parseBackground(s.theme, DEFAULT_BACKGROUND)
    const object = normalizeStarLook(s.object ?? s.theme)
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
        selfObject: DEFAULT_SELF_SELECTION,
        synapseStyle: DEFAULT_SYNAPSE_SELECTION,
        savedSelection: {
          theme: init.theme,
          object: init.object,
          selfObject: DEFAULT_SELF_SELECTION,
          synapseStyle: DEFAULT_SYNAPSE_SELECTION,
          starFormByEmotion: {},
        },
        emotionColors: {},
        starFormByEmotion: {},
        stardust: 0,
        ownedItemIds: new Set<string>(),
        setTheme: (id) => set({ theme: id }),
        setObject: (id) => set({ object: normalizeStarLook(id) }),
        setSelfObject: (id) => set({ selfObject: normalizeSelfSelection(id) }),
        setSynapseStyle: (id) => set({ synapseStyle: normalizeSynapseSelection(id) }),
        setEmotionColor: (mood, color) =>
          set((s) => ({ emotionColors: { ...s.emotionColors, [mood]: color } })),
        setStarFormByEmotion: (mood, look) =>
          set((s) => ({ starFormByEmotion: { ...s.starFormByEmotion, [mood]: normalizeStarLook(look) } })),
        applyServerSettings: (sv) =>
          set((s) => {
            // 서버 = 커밋된 진실: 4축을 해석해 라이브 선택과 savedSelection(저장 기준선) 둘 다에 반영한다 →
            // 서버 시드 직후엔 드래프트(미저장)가 없다(dirty=false). 저장은 이 응답으로 재동기화된다. 값이
            // 있으면 정규화(미지·레거시 → 유효 합성 폴백, A9), 없으면 현재 유효 선택을 유지한다.
            const theme = parseBackground(sv.theme, s.theme)
            const object = sv.object != null ? normalizeStarLook(sv.object) : s.object
            const selfObject = sv.selfObject != null ? normalizeSelfSelection(sv.selfObject) : s.selfObject
            const synapseStyle =
              sv.synapseStyle != null ? normalizeSynapseSelection(sv.synapseStyle) : s.synapseStyle
            // 색 내용이 그대로면 참조를 유지 — 4축만 바뀐 쓰기/재시드에서 별·시냅스 색
            // 전체 재베이킹(StarField aMood·UniverseSynapses colById)을 피한다.
            const keys = Object.keys(sv.emotionColors)
            const sameColors =
              keys.length === Object.keys(s.emotionColors).length &&
              keys.every((k) => sv.emotionColors[k] === s.emotionColors[k])
            // 감정별 룩 오버라이드도 시드 경계에서 정규화(미지 룩 → 디폴트 폴백, A5)하고, 내용이 그대로면
            // 참조를 유지 — 룩 맵이 바뀌면 StarField가 룩×단계 버킷을 재구성하므로 무변경 재시드는 피한다.
            const normForms: Record<string, string> = {}
            for (const k of Object.keys(sv.starFormByEmotion)) {
              normForms[k] = normalizeStarLook(sv.starFormByEmotion[k])
            }
            const formKeys = Object.keys(normForms)
            const sameForms =
              formKeys.length === Object.keys(s.starFormByEmotion).length &&
              formKeys.every((k) => normForms[k] === s.starFormByEmotion[k])
            const starFormByEmotion = sameForms ? s.starFormByEmotion : normForms
            return {
              theme,
              object,
              selfObject,
              synapseStyle,
              savedSelection: { theme, object, selfObject, synapseStyle, starFormByEmotion },
              emotionColors: sameColors ? s.emotionColors : sv.emotionColors,
              starFormByEmotion,
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
              starFormByEmotion: s.starFormByEmotion,
            },
          })),
        revertSelection: () =>
          set((s) => ({
            theme: s.savedSelection.theme,
            object: s.savedSelection.object,
            selfObject: s.savedSelection.selfObject,
            synapseStyle: s.savedSelection.synapseStyle,
            starFormByEmotion: s.savedSelection.starFormByEmotion,
          })),
        resetServerSettings: () =>
          set({ emotionColors: {}, starFormByEmotion: {}, stardust: 0, ownedItemIds: new Set<string>() }),
      }
    },
    {
      name: STORAGE_KEY,
      // 기기 선호(4축 선택)만 영속 — emotionColors·starFormByEmotion·별가루·소유권은 per-user라 메모리 전용(공용 PC 자산 미영속).
      partialize: (s) => ({
        theme: s.theme,
        object: s.object,
        selfObject: s.selfObject,
        synapseStyle: s.synapseStyle,
      }),
      // 알 수 없는/손상된/레거시 값이 저장돼 있어도 각 축의 유효 합성으로 정규화(A9). 하이드레이트된 라이브
      // 선택을 savedSelection에도 그대로 실어 로드 직후엔 드래프트(미저장)가 없게 한다 — 이후 서버 시드가
      // 인증 사용자의 진실로 둘 다 덮어쓴다(applyServerSettings).
      merge: (persisted, current) => {
        const p = persisted as Partial<AppearanceState> | undefined
        const theme = parseBackground(p?.theme, current.theme)
        const object = p?.object != null ? normalizeStarLook(p.object) : current.object
        const selfObject = p?.selfObject != null ? normalizeSelfSelection(p.selfObject) : current.selfObject
        const synapseStyle =
          p?.synapseStyle != null ? normalizeSynapseSelection(p.synapseStyle) : current.synapseStyle
        return {
          ...current,
          theme,
          object,
          selfObject,
          synapseStyle,
          // starFormByEmotion은 영속 안 함(per-user·메모리 전용) — 하이드레이트 직후엔 빈 맵(...current), 서버 시드가 채운다.
          savedSelection: { theme, object, selfObject, synapseStyle, starFormByEmotion: {} },
        }
      },
    },
  ),
)
