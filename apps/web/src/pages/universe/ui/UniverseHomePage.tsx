import { Button } from '@cosimosi/ui'
import { m } from '@cosimosi/i18n'
import { VALUES } from '@cosimosi/config'
import { SkinProvider, UniverseCanvas, UniverseScene, resolveActiveSkin, useSkin } from '@cosimosi/3d-renderer'

// The 3D universe behind everything — composed by the package's UniverseScene (skinned
// background + floating stars + bloom), so rendering vocabulary stays inside the package.
function SceneHost() {
  const { skin } = useSkin()
  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <UniverseScene skin={skin} />
    </UniverseCanvas>
  )
}

// The home screen: a full-bleed universe with a few floating actions over it. The actions
// are placeholders — their flows are product work (Epic A); this is the foundation shell.
function UniverseHome() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-text">
      <div className="absolute inset-0">
        <SceneHost />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <header className="flex justify-end">
          <Button variant="secondary" className="pointer-events-auto">
            {m.universe_home_settings()}
          </Button>
        </header>
        <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-3 pb-2">
          <Button variant="primary">{m.universe_home_write()}</Button>
          <Button variant="secondary">{m.universe_home_explore()}</Button>
        </div>
      </div>
    </main>
  )
}

export function UniverseHomePage() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <UniverseHome />
    </SkinProvider>
  )
}
