// Shared guard for layers that attach three DOM controls (OrbitControls) to the canvas
// element. react-native-webgpu's canvas shim exposes addEventListener but not
// ownerDocument, and OrbitControls dereferences ownerDocument on connect — require both
// so shared layers stay inert on native hosts instead of crashing.
export function canAttachDomControls(element: unknown): boolean {
  const probe = element as { addEventListener?: unknown; ownerDocument?: unknown }
  return typeof probe.addEventListener === 'function' && probe.ownerDocument != null
}
