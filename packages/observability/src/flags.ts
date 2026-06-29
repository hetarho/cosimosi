export type FeatureFlagValue = boolean
export type FeatureFlagKind = 'release' | 'operational' | 'kill-switch'

export interface FeatureFlagDefinition<K extends string = string> {
  readonly key: K
  readonly defaultValue: FeatureFlagValue
  readonly owner: `plan/${number}${string}` | `changes/${number}${string}` | `code-review/${number}${string}`
  readonly kind: FeatureFlagKind
  readonly description: string
  readonly review: string
  readonly remoteKey?: string
}

export interface FeatureFlagRegistry<K extends string = string> {
  readonly definitions: readonly FeatureFlagDefinition<K>[]
  getDefault(key: K): FeatureFlagValue
  getOverride(key: K): FeatureFlagValue | undefined
  resolve(key: K, remoteValue?: FeatureFlagValue): FeatureFlagValue
  withOverrides(overrides: Partial<Record<K, FeatureFlagValue>>): FeatureFlagRegistry<K>
}

export function defineFeatureFlagRegistry<const T extends readonly FeatureFlagDefinition<string>[]>(
  definitions: T,
  overrides: Partial<Record<T[number]['key'], FeatureFlagValue>> = {},
): FeatureFlagRegistry<T[number]['key']> {
  const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]))
  const overrideMap = new Map<string, FeatureFlagValue>()
  for (const [key, value] of Object.entries(overrides)) {
    if (!definitionMap.has(key)) throw new Error(`Unknown feature flag override: ${key}`)
    if (typeof value !== 'boolean') throw new Error(`Feature flags only accept boolean overrides: ${key}`)
    overrideMap.set(key, value)
  }

  return {
    definitions,
    getDefault(key) {
      const definition = definitionMap.get(key)
      if (!definition) throw new Error(`Unknown feature flag: ${key}`)
      return definition.defaultValue
    },
    getOverride(key) {
      return overrideMap.get(key)
    },
    resolve(key, remoteValue) {
      const override = overrideMap.get(key)
      if (override !== undefined) return override
      return remoteValue ?? this.getDefault(key)
    },
    withOverrides(nextOverrides) {
      return defineFeatureFlagRegistry(definitions, { ...Object.fromEntries(overrideMap), ...nextOverrides })
    },
  }
}

export const platformFeatureFlags = defineFeatureFlagRegistry([
  {
    key: 'platform.diagnosticsSurface',
    defaultValue: false,
    owner: 'plan/10.observability-and-flags',
    kind: 'operational',
    description: 'Allows development diagnostics surfaces to be enabled without changing product behavior.',
    review: 'Wired by plan/13.mobile-app-shell (mobile diagnostics route); default off keeps it out of production.',
    remoteKey: 'platform-diagnostics-surface',
  },
] as const)

export type PlatformFeatureFlagKey = (typeof platformFeatureFlags.definitions)[number]['key']

export function readFeatureFlagOverrides<K extends string>(
  definitions: readonly FeatureFlagDefinition<K>[],
  env: Record<string, string | boolean | undefined>,
  prefix = 'COSIMOSI_FLAG_',
): Partial<Record<K, FeatureFlagValue>> {
  const overrides: Partial<Record<K, FeatureFlagValue>> = {}
  for (const definition of definitions) {
    const envKey = `${prefix}${definition.key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`
    const raw = env[envKey]
    if (raw === undefined) continue
    if (raw === true || raw === 'true' || raw === '1') overrides[definition.key] = true
    else if (raw === false || raw === 'false' || raw === '0') overrides[definition.key] = false
    else throw new Error(`Invalid boolean feature flag override ${envKey}: ${String(raw)}`)
  }
  return overrides
}
