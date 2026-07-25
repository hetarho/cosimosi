// Shared guard for layers that attach three DOM controls (TrackballControls) to the canvas
// element. react-native-webgpu's canvas shim exposes addEventListener but not
// ownerDocument, and the controls dereference ownerDocument on connect — require both
// so shared layers stay inert on native hosts instead of crashing.
export function canAttachDomControls(element: unknown): boolean {
  const probe = element as { addEventListener?: unknown; ownerDocument?: unknown }
  return typeof probe.addEventListener === 'function' && probe.ownerDocument != null
}

// TrackballControls maps pointer motion through the element's on-screen size, so it must be told
// when the canvas resizes (a responsive box) or the rotation math drifts. ResizeObserver is reached
// via globalThis behind a local structural type so these shared layer bodies still typecheck in the
// native build (no DOM lib); on a host without one this stays inert and returns a no-op disposer.
export function observeElementResize(element: unknown, onResize: () => void): () => void {
  type ResizeObserverLike = { observe(target: object): void; disconnect(): void }
  const ResizeObserverCtor = (
    globalThis as { ResizeObserver?: new (callback: () => void) => ResizeObserverLike }
  ).ResizeObserver
  if (!ResizeObserverCtor || element == null) return () => {}
  const observer = new ResizeObserverCtor(onResize)
  observer.observe(element as object)
  return () => observer.disconnect()
}
