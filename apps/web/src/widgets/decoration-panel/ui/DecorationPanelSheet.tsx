import { useCallback, useEffect } from 'react'

import {
  decorationMachine,
  useDecorationRequestStore,
  useOrnamentPreviewStore,
} from '@cosimosi/store'
import { useOrnamentCatalog, useSaveDecoration } from '@cosimosi/store/react'
import { Sheet } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'
import { SaveDecorationButton } from '../../../features/buy-ornament/index.ts'
import { OrnamentGroupList } from '../../../features/preview-ornament/index.ts'
import { useActorRef, useSelector } from '../../../shared/model/index.ts'

// widgets/decoration-panel: 우주 꾸미기 over the running universe ([P5]). A Sheet, not a Dialog —
// nothing is dimmed and nothing is trapped, because the whole reason to open this is to watch the
// change land in the universe beside it, which stays camera-interactive and is never remounted.
//
// The machine holds the phase; the previewed ids live in the shared store; the catalog and the
// balance are Query. Every exit from an open panel goes through `reverting` or `committing`, so
// closing without saving cannot leave a preview behind.
export function DecorationPanelSheet() {
  const requested = useDecorationRequestStore((state) => state.requested)
  const clearRequest = useDecorationRequestStore((state) => state.clear)
  const actorRef = useActorRef(decorationMachine)
  const phase = useSelector(actorRef, (snapshot) => snapshot.value)
  const failureReason = useSelector(actorRef, (snapshot) => snapshot.context.failureReason)
  const openPreview = useOrnamentPreviewStore((state) => state.open)
  const revertPreview = useOrnamentPreviewStore((state) => state.revert)
  const { catalog } = useOrnamentCatalog()
  const save = useSaveDecoration()

  useEffect(() => {
    if (!requested) return
    openPreview()
    actorRef.send({ type: 'OPEN' })
    clearRequest()
  }, [requested, openPreview, actorRef, clearRequest])

  // The two transient phases are where the preview is actually put back or let stand. Doing it here
  // rather than inside a transition action is what makes "no exit skips it" checkable in the machine.
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
      actorRef.send({ type: 'SAVED' })
    } else {
      actorRef.send({ type: 'FAILED', reason: reason ?? '' })
    }
  }, [actorRef, save])

  const open = phase === 'browsing' || phase === 'saving'
  if (!open) return null

  return (
    <Sheet
      open
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
      <div className="flex flex-col gap-5">
        <OrnamentGroupList frozen={phase === 'saving'} />
        {/* A feeling's colour is not sold here, and someone looking for it should not have to guess
            where it went ([P10] as amended). */}
        <p className="px-3 text-xs text-text-muted">{m.store_mood_color_pointer()}</p>
      </div>
    </Sheet>
  )
}
