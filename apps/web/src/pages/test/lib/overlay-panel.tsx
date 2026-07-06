import { useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  SKIN_KEYS,
  SkinProvider,
  UNIVERSE_SKINS,
  UniverseCanvas,
  UniverseScene,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import { Badge, Button, Dialog, IconButton } from '@cosimosi/ui'

// Dev-only design showcase. Captions are demo data (see ui-gallery-panel.tsx),
// intentionally outside the product i18n catalog.
const T = {
  skinGroup: 'Universe skin',
  hud: '우주의 시간 · Y1 · D28',
  search: 'Search',
  settings: 'Settings',
  write: 'Write a diary',
  openModal: 'Open modal',
  dialogTitle: 'Modal over the universe',
  dialogDescription:
    'A dialog floats above the 3D scene — testing overlay contrast and focus trapping against a live background.',
  dialogBody: 'Judge legibility, backdrop dimming, and how the surface reads over motion.',
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
} as const

function OverlayInner() {
  const { skin, skinKey, setSkinKey } = useSkin()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={T.skinGroup} className="flex flex-wrap gap-2">
        {SKIN_KEYS.map((key) => (
          <Button key={key} size="sm" variant={key === skinKey ? 'primary' : 'secondary'} onClick={() => setSkinKey(key)}>
            {UNIVERSE_SKINS[key].label}
          </Button>
        ))}
      </div>

      <div className="relative h-[70vh] min-h-96 overflow-hidden rounded-lg bg-background">
        <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
          <UniverseScene skin={skin} />
        </UniverseCanvas>

        {/* Overlay layer: transparent to pointer events so the canvas still orbits;
            interactive clusters opt back in with pointer-events-auto. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between">
            <Badge variant="primary">{T.hud}</Badge>
            <div className="pointer-events-auto flex gap-2">
              <IconButton size="sm" variant="ghost" label={T.search} icon={<GlyphIcon />} />
              <IconButton size="sm" variant="secondary" label={T.settings} icon={<GlyphIcon />} />
            </div>
          </div>

          <div className="pointer-events-auto flex justify-center gap-3">
            <Button leadingIcon={<GlyphIcon />}>{T.write}</Button>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              {T.openModal}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={T.dialogTitle}
        description={T.dialogDescription}
        closeLabel={T.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-text-muted">{T.dialogBody}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {T.cancel}
            </Button>
            <Button onClick={() => setDialogOpen(false)}>{T.confirm}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export function OverlayPanel() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <OverlayInner />
    </SkinProvider>
  )
}

function GlyphIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="currentColor">
      <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 14.9l-5.2 2.72.99-5.8L1.58 7.62l5.82-.85L10 1.5z" />
    </svg>
  )
}
