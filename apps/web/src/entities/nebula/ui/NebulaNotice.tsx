import { useState } from 'react'

import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The honest-mirror notice ([M5], PRD §1.4): a HUD disclosure telling the user the universe's
// color is the emotions they re-read, not their emotional average — so the field never reads as a
// lie. A plain DOM affordance (not an in-canvas layer); it renders no color and reads no domain
// data. Copy is i18n message content (`m.*`), never a hardcoded string ([A9], ARCHITECTURE §5).
export function NebulaNotice() {
  const [open, setOpen] = useState(false)
  return (
    <div className="pointer-events-auto flex max-w-xs flex-col items-start gap-2">
      {open ? (
        <p className="rounded-md border border-border bg-surface-raised p-3 text-sm leading-relaxed text-text shadow-md">
          {m.universe_nebula_notice_body()}
        </p>
      ) : null}
      <Button color="neutral" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {m.universe_nebula_notice_title()}
      </Button>
    </div>
  )
}
