import { useCallback, useEffect } from 'react'
import {
  decorationMachine,
  useDecorationRequestStore,
  useOrnamentPreviewStore,
} from '@cosimosi/store'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useOrnamentCatalog, useSaveDecoration } from '@cosimosi/store/react'
import { Sheet } from '@cosimosi/ui'
import { useActorRef, useSelector } from '@cosimosi/state-machine/react'
import { m } from '../../../shared/i18n/index.ts'

import { SaveDecorationButton } from '../../../features/buy-ornament/index.ts'
import { OrnamentGroupList } from '../../../features/preview-ornament/index.ts'
// widgets/decoration-panel (native fork of the web sheet): 우주 꾸미기 over the running universe
// ([P5]). Not a Modal — the canvas above stays visible and gesture-interactive, which is the whole
// point of opening this. `active` gates consumption on the focused screen: the universe screen stays
// mounted under the native stack, so an unfocused panel must not answer an open request.
export function DecorationPanelSheet({ active }: { readonly active: boolean }) {
  const requested = useDecorationRequestStore((state) => state.requested)
  const clearRequest = useDecorationRequestStore((state) => state.clear)
  const actorRef = useActorRef(decorationMachine)
  const phase = useSelector(actorRef, (snapshot) => snapshot.value)
  const failureReason = useSelector(actorRef, (snapshot) => snapshot.context.failureReason)
  const openPreview = useOrnamentPreviewStore((state) => state.open)
  const revertPreview = useOrnamentPreviewStore((state) => state.revert)
  const { catalog } = useOrnamentCatalog()
  const save = useSaveDecoration()
  // A save records three counters, so the achievement read is refreshed on resolution — the seam
  // this panel's own job left for the achievement surface to wire.
  const invalidateAchievements = useInvalidateAchievements()

  useEffect(() => {
    if (!active || !requested) return
    openPreview()
    actorRef.send({ type: 'OPEN' })
    clearRequest()
  }, [active, requested, openPreview, actorRef, clearRequest])

  // Leaving the screen is an exit like any other: the preview goes back rather than following the user
  // to another tab. `phase` is a dependency because a save in flight refuses CLOSE — when it settles
  // back to `browsing` off-screen, this has to ask again rather than leave a hidden panel to revive.
  useEffect(() => {
    if (!active) actorRef.send({ type: 'CLOSE' })
  }, [active, phase, actorRef])

  useEffect(() => {
    if (phase === 'reverting') {
      revertPreview()
      actorRef.send({ type: 'SETTLED' })
    }
    if (phase === 'committing') actorRef.send({ type: 'SETTLED' })
  }, [phase, revertPreview, actorRef])

  // Leaving the route unmounts this panel without any CLOSE, so the revert has to happen here too:
  // otherwise a preview would outlive the surface that installed it and the universe would come back
  // wearing something nobody saved. After a commit this is a no-op — `confirmed` is already the new
  // selection.
  useEffect(() => () => revertPreview(), [revertPreview])

  const handleSave = useCallback(async () => {
    actorRef.send({ type: 'SAVE' })
    // Only the send that actually MOVED the machine may start a request: a second press while one is in
    // flight is refused by the machine, and must not fire a second Decorate behind its back.
    if (actorRef.getSnapshot().value !== 'saving') return
    const { saved, reason } = await save()
    if (saved) {
      invalidateAchievements()
      actorRef.send({ type: 'SAVED' })
    } else {
      actorRef.send({ type: 'FAILED', reason: reason ?? '' })
    }
  }, [actorRef, save, invalidateAchievements])

  // Handed to the Sheet rather than used to unmount it here: the Sheet holds itself for one animation
  // past a close so it can slide back out the edge it came in from, and returning null on this line
  // would take the element away before it could.
  const open = phase === 'browsing' || phase === 'saving'

  return (
    <Sheet
      open={open}
      onClose={() => actorRef.send({ type: 'CLOSE' })}
      title={m.store_panel_title()}
      closeLabel={m.store_panel_close()}
      closeDisabled={phase === 'saving'}
      footer={
        <SaveDecorationButton
          catalog={catalog}
          saving={phase === 'saving'}
          failureReason={failureReason}
          onSave={handleSave}
        />
      }
    >
      <OrnamentGroupList frozen={phase === 'saving'} />
    </Sheet>
  )
}
