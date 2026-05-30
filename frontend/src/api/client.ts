const baseUrl = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = baseUrl ? `${baseUrl}${path}` : path
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export type HealthResponse = { status: string; version: string }

export const api = {
  health: () => request<HealthResponse>('/health'),
}
