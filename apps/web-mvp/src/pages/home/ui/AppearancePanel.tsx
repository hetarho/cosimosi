// 홈 외형 편집 패널(spec 44 · change 10) — 전면 모달이 아니라 **실제 우주 옆 split panel**이다. 열려도
// `UniverseCanvas`는 언마운트되지 않고(HomePage가 split layout으로 폭/높이만 줄인다), 선택 드래프트가
// 메인 우주에 라이브로 반영된다 — 상단 고정 프리뷰/샘플 CosmosScene은 없다(권위 있는 프리뷰 = 실제 우주).
// 4축 스킨만 다룬다(감정 색 편집은 /my-page로 이동). 항목은 4축 인벤토리(`AppearanceControls draft`)의
// 가벼운 swatch 토큰으로 보이고(항목마다 라이브 3D 우주를 띄우지 않음), 저장 규칙(미구매 일괄 구매·잔액
// 가드·체험 무상)은 기존과 같다. 데스크톱=좌측 사이드바, 모바일=하단 패널(내용 동일, 위치/모서리만 다름).
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { isDemoMode } from '@/shared/lib/demo'
import { capture, cn, EVENTS } from '@/shared/lib'
import { subItemIds, isFree, isOwned, priceOf, type Axis } from '@/shared/config'
import { useAppearance, pushSettings, purchaseItem } from '@/entities/appearance'
import { AppearanceControls } from '@/features/switch-appearance'

export interface AppearancePanelProps {
  onClose: () => void
  /** 좌측(데스크톱 fine pointer) vs 하단(모바일 coarse pointer) — 위치/모서리/크기만 다르고 내용은 같다. */
  placement: 'side' | 'bottom'
}

/** 홈 전용 스킨 편집 패널. HomePage가 split layout의 좌측/하단 sibling으로 마운트한다(캔버스는 그 옆에서 계속 산다). */
export function AppearancePanel({ onClose, placement }: AppearancePanelProps) {
  const navigate = useNavigate()
  const theme = useAppearance((s) => s.theme)
  const object = useAppearance((s) => s.object)
  const selfObject = useAppearance((s) => s.selfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const starFormByEmotion = useAppearance((s) => s.starFormByEmotion)
  const ownedItemIds = useAppearance((s) => s.ownedItemIds)
  const saved = useAppearance((s) => s.savedSelection)
  const stardust = useAppearance((s) => s.stardust)
  const commitSelection = useAppearance((s) => s.commitSelection)
  const revertSelection = useAppearance((s) => s.revertSelection)
  const [saving, setSaving] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  const unlocked = isDemoMode()

  // 드래프트 여부(라이브 ≠ 마지막 저장) — 패널은 전역 4축만 다룬다(감정별 룩 편집은 스튜디오로 이전, change 33).
  const dirty =
    theme !== saved.theme ||
    object !== saved.object ||
    selfObject !== saved.selfObject ||
    synapseStyle !== saved.synapseStyle
  const selected: [Axis, string][] = [
    ['background', theme],
    ['star', object],
    ['self', selfObject],
    ['synapse', synapseStyle],
  ]
  // 저장 시 살 미구매 유료 sub-item — 전역 4축만. 합성 선택은 form·surface로 분해(spec 52 A5). 감정별 룩 구매는
  // 스튜디오 저장이 책임진다(change 33). id로 중복 제거.
  const pending = (() => {
    if (unlocked) return []
    const byId = new Map<string, Axis>()
    for (const [ax, sel] of selected) for (const id of subItemIds(ax, sel)) if (!byId.has(id)) byId.set(id, ax)
    return [...byId]
      .filter(([id]) => !isFree(id) && !isOwned(id, ownedItemIds))
      .map(([id, axis]) => ({ axis, id }))
  })()
  const pendingCost = pending.reduce((s, p) => s + (priceOf(p.id) ?? 0), 0)
  const affordable = stardust >= pendingCost

  // 저장(구매 포함): 미구매 유료 아이템을 먼저 사고(체험은 없음) 4축을 영속한 뒤 닫는다. 변경 없으면 그냥 닫는다.
  const onSave = async () => {
    if (saving || !affordable) return
    if (!dirty) {
      onClose()
      return
    }
    setSaving(true)
    try {
      for (const p of pending) {
        await purchaseItem(p.id)
        capture(EVENTS.appearancePurchase, { item_id: p.id, axis: p.axis, price: priceOf(p.id) ?? 0 })
      }
      // 전역 4축만 편집한다(감정별 룩은 스튜디오, change 33). starFormByEmotion은 현재 store 값(= 마지막 저장,
      // 패널이 안 바꿈)을 그대로 패스 — BE emotion_forms는 upsert-only라 기존 오버라이드를 보존한다(덮어쓰지 않음).
      const ok = await pushSettings({ theme, starObject: object, selfObject, synapseStyle, starFormByEmotion })
      if (ok || unlocked) commitSelection()
      onClose()
    } catch (e) {
      console.error('[appearance.save]', e)
    } finally {
      setSaving(false)
    }
  }

  // 뒤로/닫기: 변경이 있으면 미저장 경고, 없으면 그냥 닫는다. "나가기"는 드래프트를 버리고 마지막 저장으로 복원.
  const onBack = () => {
    if (dirty) setConfirmExit(true)
    else onClose()
  }
  const onDiscardExit = () => {
    revertSelection()
    setConfirmExit(false)
    onClose()
  }

  const saveLabel = saving
    ? '저장 중…'
    : pendingCost > 0
      ? affordable
        ? `저장 · ${pendingCost} 별가루`
        : `별가루 부족 · ${pendingCost}`
      : '저장'

  return (
    <div
      className={cn(
        'relative z-30 flex shrink-0 flex-col border-white/10 bg-[#070a16]/95 backdrop-blur-md',
        placement === 'side'
          ? 'h-full w-[min(22rem,82vw)] border-r'
          : 'max-h-[52dvh] w-full border-t',
      )}
      role="region"
      aria-label="꾸미기 — 스킨"
    >
      {/* 헤더: 뒤로/닫기(미저장 시 경고) + 제목. */}
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 px-4 pb-3',
          placement === 'side' ? 'pt-[calc(1rem+env(safe-area-inset-top))]' : 'pt-3',
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white/95"
        >
          <ArrowLeft className="size-4" aria-hidden />
          뒤로
        </button>
        <h2 className="ml-1 font-display text-base text-white/90">꾸미기</h2>
      </header>

      {/* 4축 인벤토리(배경·별·광원·시냅스) — swatch 토큰 + 이름/설명/잠금/가격. draft=홈: 미리보기만, 저장 바가 커밋.
          선택 결과는 별도 샘플이 아니라 옆의 실제 우주에서 라이브로 확인한다(change 10). */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-1">
        <AppearanceControls draft onCustomizeEmotions={() => void navigate({ to: '/emotion-stars' })} />
      </div>

      {/* 저장(구매 포함) — 하단 command bar(잔액 부족이면 비활성). */}
      <div
        className={cn(
          'shrink-0 border-t border-white/10 px-4 pt-3',
          placement === 'side'
            ? 'pb-[calc(0.9rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(0.9rem+env(safe-area-inset-bottom))]',
        )}
      >
        <button
          type="button"
          onClick={() => void onSave()}
          aria-disabled={!affordable || saving}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition',
            affordable && !saving
              ? 'bg-white/90 text-black hover:bg-white'
              : 'cursor-not-allowed bg-white/10 text-white/40',
          )}
        >
          {saveLabel}
        </button>
      </div>

      {/* 미저장 경고 — 뒤로가기 시 드래프트가 마지막 저장과 다르면. "나가기"는 드래프트를 버리고 마지막 저장으로 복원. */}
      {confirmExit && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/65 p-6">
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0c0e1c] p-5 text-center">
            <p className="text-sm text-white/90">변경사항이 저장되지 않아요</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">
              지금 나가면 고른 외형이 사라지고 마지막 저장 상태로 돌아가요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:text-white/95"
              >
                계속 편집
              </button>
              <button
                type="button"
                onClick={onDiscardExit}
                className="flex-1 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-black transition hover:bg-white"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
