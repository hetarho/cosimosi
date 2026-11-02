import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useDecorationPanelController } from '@cosimosi/store/react'
import { Sheet } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'
import { SaveDecorationButton } from '../../../features/buy-ornament/index.ts'
import { OrnamentGroupList } from '../../../features/preview-ornament/index.ts'
// widgets/decoration-panel: 우주 꾸미기 over the running universe ([P5]). A Sheet, not a Dialog —
// nothing is dimmed and nothing is trapped, because the whole reason to open this is to watch the
// change land in the universe beside it, which stays camera-interactive and is never remounted.
//
// The machine holds the phase; the previewed ids live in the shared store; the catalog and the
// balance are Query. Every exit from an open panel goes through `reverting` or `committing`, so
// closing without saving cannot leave a preview behind.
export function DecorationPanelSheet() {
  // Opening on a request, the preview's install/revert and the save are the store package's panel
  // controller; this sheet is the markup.
  const { open, saving, failureReason, catalog, save, close } = useDecorationPanelController({
    invalidateAchievements: useInvalidateAchievements(),
  })

  return (
    <Sheet
      open={open}
      onClose={close}
      title={m.store_panel_title()}
      closeLabel={m.store_panel_close()}
      closeDisabled={saving}
      footer={
        <SaveDecorationButton
          catalog={catalog}
          saving={saving}
          failureReason={failureReason}
          onSave={save}
        />
      }
    >
      <OrnamentGroupList frozen={saving} />
    </Sheet>
  )
}
