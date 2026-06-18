import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { capture, cn, EVENTS } from '@/shared/lib'
import { isDemoMode } from '@/shared/lib/demo'
import { itemId, isFree, isOwned, priceOf, type Axis } from '@/shared/config'
import { useAppearance, pushSettings, purchaseItem } from '@/entities/appearance'

/**
 * 플로팅 저장 바(홈, spec 44) — 외형을 드래프트로 바꾸면(라이브 선택 ≠ savedSelection) 떠서, 우주의 변화를
 * 본 뒤 한 번에 커밋한다. 드래프트에 미구매 유료 아이템이 있으면 라벨이 "저장 · N 별가루"가 되고(추후
 * 아이콘으로), 저장 시 그 아이템들을 먼저 구매한 뒤 4축 선택을 서버에 영속한다. 잔액이 모자라면 막힌다.
 * "되돌리기"는 드래프트를 버리고 마지막 저장 상태로 되돌린다. **체험(데모)도 같은 경험으로 노출하되 전부
 * 잠금 해제(무상)라 구매가 없고 라벨은 항상 "저장"**(로컬 확정만). 플레이그라운드(랜딩/사인인)는 이 바를
 * 마운트하지 않는다(HomePage 전용). 구매·영속 로직은 settings-query(api)가 소유.
 */
export function AppearanceSaveBar() {
  const theme = useAppearance((s) => s.theme)
  const object = useAppearance((s) => s.object)
  const selfObject = useAppearance((s) => s.selfObject)
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const saved = useAppearance((s) => s.savedSelection)
  const ownedItemIds = useAppearance((s) => s.ownedItemIds)
  const stardust = useAppearance((s) => s.stardust)
  const commitSelection = useAppearance((s) => s.commitSelection)
  const revertSelection = useAppearance((s) => s.revertSelection)
  const [saving, setSaving] = useState(false)

  const dirty =
    theme !== saved.theme ||
    object !== saved.object ||
    selfObject !== saved.selfObject ||
    synapseStyle !== saved.synapseStyle

  // 현재 선택 중 미소유 유료 아이템(저장 시 구매 대상)과 합계 가격.
  const selected: [Axis, string][] = [
    ['background', theme],
    ['star', object],
    ['self', selfObject],
    ['synapse', synapseStyle],
  ]
  // 체험(데모)은 모든 아이템이 열려 있다(무상) — 구매 대상 없음. 실로그인만 미소유 유료 아이템을 모은다.
  const demo = isDemoMode()
  const pending = demo
    ? []
    : selected
        .map(([axis, kind]) => ({ axis, id: itemId(axis, kind) }))
        .filter((p) => !isFree(p.id) && !isOwned(p.id, ownedItemIds))
  const pendingCost = pending.reduce((sum, p) => sum + (priceOf(p.id) ?? 0), 0)
  const affordable = stardust >= pendingCost

  const onSave = async () => {
    if (saving || !affordable) return // aria-disabled는 클릭을 막지 않음 — 가드
    setSaving(true)
    try {
      // 미구매 아이템을 먼저 산다(체험은 pending 비어 있음). 각 구매: 낙관적 차감→RPC→서버 권위(실패 시 throw).
      for (const p of pending) {
        await purchaseItem(p.id)
        capture(EVENTS.appearancePurchase, { item_id: p.id, axis: p.axis, price: priceOf(p.id) ?? 0 })
      }
      // 4축 선택을 서버에 영속(체험은 no-op·false). 성공이거나 체험이면 드래프트를 기준선으로 확정 → 바 사라짐.
      const ok = await pushSettings({ theme, starObject: object, selfObject, synapseStyle })
      if (ok || demo) commitSelection()
    } catch (e) {
      console.error('[appearance.save]', e)
    } finally {
      setSaving(false)
    }
  }

  // 드래프트(라이브 ≠ 저장)가 없으면 숨긴다. 체험에서도 같은 경험으로 노출한다(전부 무상 — 라벨 "저장").
  // (모든 훅 뒤에서 분기 — 훅 순서 보존)
  if (!dirty) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5 pl-4">
        <span className="mr-1 hidden text-[11px] text-white/50 sm:inline">미리보기 중</span>
        <button
          type="button"
          onClick={revertSelection}
          disabled={saving}
          className="rounded-full px-3 py-1.5 text-xs text-white/55 transition hover:text-white/85 disabled:opacity-40"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-disabled={!affordable || saving}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition',
            affordable && !saving
              ? 'bg-white/90 text-black hover:bg-white'
              : 'cursor-not-allowed bg-white/10 text-white/40',
          )}
        >
          {pendingCost > 0 && <Sparkles className="size-3.5" aria-hidden />}
          {saving
            ? '저장 중…'
            : pendingCost > 0
              ? affordable
                ? `저장 · ${pendingCost} 별가루`
                : `별가루 부족 · ${pendingCost} 별가루`
              : '저장'}
        </button>
      </div>
    </div>
  )
}
