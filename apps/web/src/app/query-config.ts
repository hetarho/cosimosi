interface WebApiEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_URL?: string
}

export function resolveWebApiBaseUrl(env: object): string {
  const values = env as WebApiEnv
  return values.VITE_API_BASE_URL || values.VITE_API_URL || 'http://localhost:8080'
}
