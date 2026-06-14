import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, fromPromise, fromCallback, type Actor, type SnapshotFrom } from 'xstate'
import type { Session } from '@supabase/supabase-js'

// 머신이 import하는 플랫폼/부수효과 모듈을 막는다(provide로 액터를 대체하므로 supabase는 호출 안 됨).
vi.mock('@/shared/api', () => ({ supabase: { auth: {} } }))
const resetUniverseData = vi.fn()
vi.mock('./reset-universe-data', () => ({ resetUniverseData: () => resetUniverseData() }))
const identifyUser = vi.fn()
const resetAnalyticsIdentity = vi.fn()
const capture = vi.fn()
vi.mock('@/shared/lib', () => ({
  capture: (...a: unknown[]) => capture(...a),
  identifyUser: (...a: unknown[]) => identifyUser(...a),
  resetAnalyticsIdentity: (...a: unknown[]) => resetAnalyticsIdentity(...a),
  EVENTS: { signIn: 'sign_in' },
}))

import { sessionMachine } from './session.machine'

type Snap = SnapshotFrom<typeof sessionMachine>

const fakeSession = (uid: string) => ({ user: { id: uid } }) as unknown as Session

// getSession 결과만 갈아끼우고 구독(authChanges)은 무음 stub으로.
function provided(getSession: () => Promise<Session | null>) {
  return sessionMachine.provide({
    actors: {
      getSession: fromPromise(getSession),
      authChanges: fromCallback(() => () => {}),
    },
  })
}

function waitFor(actor: Actor<typeof sessionMachine>, pred: (s: Snap) => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (pred(actor.getSnapshot())) return resolve()
    const sub = actor.subscribe((s) => {
      if (pred(s)) {
        sub.unsubscribe()
        resolve()
      }
    })
  })
}

beforeEach(() => {
  resetUniverseData.mockClear()
  identifyUser.mockClear()
  resetAnalyticsIdentity.mockClear()
  capture.mockClear()
})

describe('sessionMachine', () => {
  it('부팅: 저장된 세션이 없으면 anon', async () => {
    const a = createActor(provided(async () => null)).start()
    await waitFor(a, (s) => !s.matches('loading'))
    expect(a.getSnapshot().value).toBe('anon')
    a.stop()
  })

  it('부팅: 저장된 세션이 있으면 authed + 식별/signIn, 첫 식별은 리셋 없음(베이스라인)', async () => {
    const a = createActor(provided(async () => fakeSession('u1'))).start()
    await waitFor(a, (s) => s.matches('authed'))
    expect(a.getSnapshot().context.session).not.toBeNull()
    expect(identifyUser).toHaveBeenCalledWith('u1')
    expect(capture).toHaveBeenCalledWith('sign_in', {})
    expect(resetUniverseData).not.toHaveBeenCalled() // undefined→u1 은 베이스라인
    a.stop()
  })

  it('부팅: getSession이 reject면 anon으로(무한 스플래시 방지) — 경계 리셋·분석 없음', async () => {
    const a = createActor(
      provided(async () => {
        throw new Error('boom')
      }),
    ).start()
    await waitFor(a, (s) => !s.matches('loading'))
    expect(a.getSnapshot().value).toBe('anon')
    expect(resetUniverseData).not.toHaveBeenCalled()
    expect(identifyUser).not.toHaveBeenCalled()
    a.stop()
  })

  it('AUTH_CHANGED: 세션이면 authed, null이면 anon', async () => {
    const a = createActor(provided(async () => null)).start()
    await waitFor(a, (s) => s.matches('anon'))
    a.send({ type: 'AUTH_CHANGED', session: fakeSession('u1') })
    expect(a.getSnapshot().matches('authed')).toBe(true)
    a.send({ type: 'AUTH_CHANGED', session: null })
    expect(a.getSnapshot().matches('anon')).toBe(true)
    a.stop()
  })

  it('경계: uid가 바뀔 때마다 resetUniverseData 호출(계정 전환 시 데이터 누수 차단)', async () => {
    const a = createActor(provided(async () => null)).start()
    await waitFor(a, (s) => s.matches('anon')) // last=null 로 베이스라인
    resetUniverseData.mockClear()
    a.send({ type: 'AUTH_CHANGED', session: fakeSession('A') }) // null→A 경계
    a.send({ type: 'AUTH_CHANGED', session: fakeSession('B') }) // A→B 경계
    expect(resetUniverseData).toHaveBeenCalledTimes(2)
    a.stop()
  })

  it('FORCE_ANON: authed에서 강제 강하 + 출처 경계 리셋(signOut 실패 폴백)', async () => {
    const a = createActor(provided(async () => fakeSession('u1'))).start()
    await waitFor(a, (s) => s.matches('authed'))
    resetUniverseData.mockClear()
    resetAnalyticsIdentity.mockClear()
    a.send({ type: 'FORCE_ANON' })
    expect(a.getSnapshot().matches('anon')).toBe(true)
    expect(a.getSnapshot().context.session).toBeNull()
    // 핵심: 이전 계정 캐시·분석 식별이 남지 않아야 한다(구 syncIdentity(null) 동작 보존).
    expect(resetUniverseData).toHaveBeenCalledTimes(1)
    expect(resetAnalyticsIdentity).toHaveBeenCalledTimes(1)
    a.stop()
  })
})
