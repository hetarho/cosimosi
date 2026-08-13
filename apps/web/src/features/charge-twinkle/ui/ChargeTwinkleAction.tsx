import { AddIcon, Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui: the way to come by more 별가루 than living in the product hands over.
//
// It performs NOTHING yet, and says so. There is no purchase path in the product (PRD §8.3), so the
// control is DISABLED with the reason written beside it rather than left pressable and failing, or
// left out altogether: a reader looking at a balance they have run down needs to know whether more is
// coming at all, and "아직" is a different answer from silence. When a path exists, this slice grows
// an `api` segment and the button loses its `disabled` — nothing above it has to change.
export function ChargeTwinkleAction() {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <Button color="primary" leadingIcon={<AddIcon />} disabled>
        {m.twinkle_charge_action()}
      </Button>
      <p className="text-center text-xs text-text-muted">{m.twinkle_charge_unavailable()}</p>
    </div>
  )
}
