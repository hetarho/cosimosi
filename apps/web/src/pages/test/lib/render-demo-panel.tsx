import { Button } from '@cosimosi/ui'
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

import { m } from '../../../shared/i18n/index.ts'

function RenderDemoInner() {
  const { skin, skinKey, setSkinKey } = useSkin()
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={m.test_harness_render_skin_group_label()} className="flex flex-wrap gap-2">
        {SKIN_KEYS.map((key) => (
          <Button key={key} variant={key === skinKey ? 'primary' : 'secondary'} onClick={() => setSkinKey(key)}>
            {UNIVERSE_SKINS[key].label}
          </Button>
        ))}
      </div>
      <div className="h-96 overflow-hidden rounded-lg bg-background">
        <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
          <UniverseScene skin={skin} />
        </UniverseCanvas>
      </div>
    </div>
  )
}

export function RenderDemoPanel() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <RenderDemoInner />
    </SkinProvider>
  )
}
