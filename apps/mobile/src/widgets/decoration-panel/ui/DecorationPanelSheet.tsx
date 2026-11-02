import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useDecorationPanelController } from '@cosimosi/store/react'
import { Sheet } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'

import { SaveDecorationButton } from '../../../features/buy-ornament/index.ts'
import { OrnamentGroupList } from '../../../features/preview-ornament/index.ts'
// widgets/decoration-panel (native fork of the web sheet): 우주 꾸미기 over the running universe
// ([P5]). Not a Modal — the canvas above stays visible and gesture-interactive, which is the whole
// point of opening this. `active` gates consumption on the focused screen: the universe screen stays
// mounted under the native stack, so an unfocused panel must not answer an open request.
export function DecorationPanelSheet({ active }: { readonly active: boolean }) {
  // Opening on a request, closing when the tab loses focus, the preview's install/revert and the save
  // are the store package's panel controller; this sheet is the markup.
  const { open, saving, failureReason, catalog, save, close } = useDecorationPanelController({
    active,
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
