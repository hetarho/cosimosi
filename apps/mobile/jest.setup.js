/* global jest */

// @sentry/react-native touches the native bridge at import; the shell never wires
// a real Sentry DSN in host tests (it passes a fake observability facade), so a
// no-op mock keeps the import side-effect-free.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}))
