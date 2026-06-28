export type TelemetryScalar = string | number | boolean | null
export type TelemetryValue = TelemetryScalar | readonly TelemetryScalar[]
export type TelemetryPropertyBag = Record<string, TelemetryValue | undefined>

export const sensitiveTelemetryKeys = [
  'diaryText',
  'diary_text',
  'recordBody',
  'record_body',
  'memoryContent',
  'memory_content',
  'generatedMemoryContent',
  'generated_memory_content',
  'rawEmbedding',
  'raw_embedding',
  'embedding',
  'token',
  'authToken',
  'auth_token',
  'accessToken',
  'access_token',
  'idToken',
  'id_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'password',
] as const

type SensitiveTelemetryKey = (typeof sensitiveTelemetryKeys)[number]
type NormalizedSensitiveTelemetryKey = Lowercase<SensitiveTelemetryKey>

const sensitiveKeySet = new Set<string>(sensitiveTelemetryKeys.map(normalizeTelemetryKey))

export type SafeTelemetryProperties<T extends TelemetryPropertyBag = TelemetryPropertyBag> = {
  readonly [K in keyof T]: K extends string ? (Lowercase<K> extends NormalizedSensitiveTelemetryKey ? never : T[K]) : T[K]
}

export function safeTelemetryProperties<const T extends TelemetryPropertyBag>(
  properties: SafeTelemetryProperties<T>,
): SafeTelemetryProperties<T> {
  assertSafeTelemetryProperties(properties)
  return properties
}

export function normalizeTelemetryProperties<const T extends TelemetryPropertyBag>(
  properties?: SafeTelemetryProperties<T>,
): TelemetryPropertyBag {
  if (!properties) return {}
  assertSafeTelemetryProperties(properties)
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined))
}

export function assertSafeTelemetryProperties(properties: TelemetryPropertyBag): void {
  for (const key of Object.keys(properties)) {
    if (sensitiveKeySet.has(normalizeTelemetryKey(key))) {
      throw new Error(`Sensitive telemetry property is not allowed: ${key}`)
    }
  }
}

function normalizeTelemetryKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase()
}
