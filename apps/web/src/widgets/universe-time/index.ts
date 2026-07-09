export { UniverseTimeOverlay } from './ui/UniverseTimeOverlay.tsx'
// The recall flow ([R1a]) opens sync consent by importing requestTimeSyncConsent directly from
// features/confirm-time-sync (a downward feature→feature import). It must NOT re-route through this
// widget: a feature importing a widget symbol is an upward import the FSD boundary forbids (§3.1).
