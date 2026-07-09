/* global globalThis */

/**
 * React Native global polyfills. Imported first in index.js — before the app's
 * module graph — so the globals exist when transitive deps initialize.
 *
 * @bufbuild/protobuf builds UTF-8 codecs at module-eval time via
 * `new globalThis.TextEncoder()/TextDecoder()`; Hermes ships neither, so the
 * transport stack (api-client → protobuf) throws on load without this shim.
 */
import { TextDecoder, TextEncoder } from 'text-encoding'

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}
