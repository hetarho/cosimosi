import { m } from '@cosimosi/i18n'

// Registry ids resolve to localized display names here; the registry's own `name` is a
// code-facing label, not copy. An id without a message falls back to that label so a palette
// added to the registry before its copy lands still renders named, never blank.
const PALETTE_NAME_MESSAGES: Readonly<Record<string, () => string>> = {
  'cosimosi-default': m.palette_name_cosimosi_default,
  'muted-dusk': m.palette_name_muted_dusk,
}

export function paletteDisplayName(id: string, registryName: string): string {
  return PALETTE_NAME_MESSAGES[id]?.() ?? registryName
}
