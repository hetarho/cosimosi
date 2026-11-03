// shared/lib: whether the document is on screen at all.
//
// A hidden tab already slows rAF, but it does not stop it everywhere, and a canvas host that keeps
// its loop running still holds the GPU awake for a page nobody can see. Surfaces that own a render
// loop read this and park it instead of trusting the browser to.

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

function isVisible(): boolean {
  return document.visibilityState !== 'hidden'
}

// A server or prerender pass has no document; the first client read decides.
function isVisibleOnServer(): boolean {
  return true
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, isVisible, isVisibleOnServer)
}
