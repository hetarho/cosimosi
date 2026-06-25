// 망원경 탐색 표면(change 09) — 우주 셸 위 비차단 Surface(모바일 바텀시트 / 데스크톱 떠있는 카드,
// overlay-shell 원칙) 안에 `일기`·`별` 두 탭을 띄운다. 페이지(HomePage)가 이 시트를 합성하고
// 탭 선택을 받는다(features는 widget/page를 import하지 않음 — FSD). 일기 선택은 frame-all, 별 선택은
// FLY_TO_STAR로 수렴한다 — 우주를 떠나지 않는다.
import { DiarySheet } from '@/features/diary-list'
import { StarExplorerList } from '@/features/star-explorer'
import { Surface } from '@/shared/ui'

export type ExplorerTab = 'diary' | 'star'

export interface UniverseExplorerSheetProps {
  open: boolean
  tab: ExplorerTab
  onTab: (tab: ExplorerTab) => void
  onClose: () => void
  /** 일기 선택 → 그 일기의 별 frame-all + peek(페이지가 focus SELECT_DIARY로 배선). */
  onSelectDiary: (recordId: string) => void
  /** 별 선택 → 그 별로 fly-to + peek(페이지가 navigationActor.FLY_TO_STAR로 배선). */
  onSelectStar: (memoryId: string) => void
}

const TABS: { key: ExplorerTab; label: string }[] = [
  { key: 'diary', label: '일기' },
  { key: 'star', label: '별' },
]

export function UniverseExplorerSheet({
  open,
  tab,
  onTab,
  onClose,
  onSelectDiary,
  onSelectStar,
}: UniverseExplorerSheetProps) {
  return (
    <Surface open={open} title="탐색" onClose={onClose} place="top">
      <div role="tablist" aria-label="탐색 탭" className="flex shrink-0 gap-1 rounded-lg bg-white/5 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            data-tour-id={t.key === 'diary' ? 'explorer-diary-tab' : 'explorer-star-tab'}
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === t.key ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* 첫 별 튜토리얼(change 34): 탭 버튼과 별개로 콘텐츠 영역 전체를 정보 하이라이트 target으로 감싼다
          (A13 일기 패널·A14 별 패널). 래퍼는 셸 콘텐츠 컬럼의 flex-1 자식이라 내부 목록의 자체 스크롤이 그대로 동작한다. */}
      {tab === 'diary' ? (
        <div data-tour-id="explorer-diary-panel" className="flex min-h-0 flex-1 flex-col gap-3">
          <DiarySheet onSelectDiary={onSelectDiary} />
        </div>
      ) : (
        <div data-tour-id="explorer-star-panel" className="flex min-h-0 flex-1 flex-col gap-3">
          <StarExplorerList onSelect={onSelectStar} />
        </div>
      )}
    </Surface>
  )
}
