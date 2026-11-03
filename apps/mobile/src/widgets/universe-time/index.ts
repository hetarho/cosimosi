export { UniverseTimeOverlay } from './ui/UniverseTimeOverlay.tsx'
// The recall flow ([R1a]) opens sync consent through `requestTimeSyncConsent` in `@cosimosi/universe`.
// It must NOT re-route through this widget: a feature importing a widget symbol is an upward import
// the FSD boundary forbids (ARCH-21).
