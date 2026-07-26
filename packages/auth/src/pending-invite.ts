const PENDING_INVITE_STORAGE_KEY = 'cosimosi.pending-invite'

export interface PendingInviteStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PendingInviteHolder {
  capture(token: string): void
  peek(): string | null
  consume(): string | null
  clear(): void
}

export function createPendingInviteHolder(storage: PendingInviteStorage): PendingInviteHolder {
  return {
    capture(token) {
      const normalized = token.trim()
      if (normalized) {
        storage.setItem(PENDING_INVITE_STORAGE_KEY, normalized)
      } else {
        storage.removeItem(PENDING_INVITE_STORAGE_KEY)
      }
    },
    peek() {
      return storage.getItem(PENDING_INVITE_STORAGE_KEY)
    },
    consume() {
      const token = storage.getItem(PENDING_INVITE_STORAGE_KEY)
      storage.removeItem(PENDING_INVITE_STORAGE_KEY)
      return token
    },
    clear() {
      storage.removeItem(PENDING_INVITE_STORAGE_KEY)
    },
  }
}

export function createMemoryPendingInviteStorage(): PendingInviteStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

let activeHolder = createPendingInviteHolder(createMemoryPendingInviteStorage())

/**
 * App composition roots inject tab/process-appropriate storage. The holder is
 * intentionally outside the user-scope reset registry: it must survive the
 * anonymous → authenticated transition and is cleared only on consume or when
 * an established profile enters.
 */
export function bindPendingInviteStorage(storage: PendingInviteStorage): void {
  activeHolder = createPendingInviteHolder(storage)
}

export const pendingInvite: PendingInviteHolder = {
  capture: (token) => activeHolder.capture(token),
  peek: () => activeHolder.peek(),
  consume: () => activeHolder.consume(),
  clear: () => activeHolder.clear(),
}

/** The canonical public web path used by both invite sharing and capture. */
export function inviteLinkPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`
}
