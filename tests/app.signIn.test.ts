import { describe, expect, it } from 'vitest'
import type { DeviceCode, Identity, PollOutcome } from '@domain/auth'
import { fail, ok, type Result } from '@domain/errors'
import type { Ports } from '@domain/ports'
import { restoreSession, signIn, signOut } from '@app/signIn'

/**
 * The whole sign-in flow, without a network and without waiting a real second.
 *
 * This is what the ports buy: the polling loop, the cancellation, the scope
 * check and the token storage are all exercised here in milliseconds. GitHub is
 * a script of answers, and `sleep` merely counts.
 */
const CODE: DeviceCode = {
  deviceCode: 'secret',
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5
}

const IDENTITY: Identity = { login: 'famaridon', name: 'Florent' }

interface Rig {
  ports: Ports
  slept: number[]
  written: string[]
  cleared: number
  codesShown: DeviceCode[]
}

/** GitHub answers the given script, one poll at a time. */
const rig = (
  script: (Result<PollOutcome>)[],
  over: { identify?: Result<Identity>; write?: Result<void>; requestCode?: Result<DeviceCode> } = {}
): Rig => {
  const slept: number[] = []
  const written: string[] = []
  const codesShown: DeviceCode[] = []
  let cleared = 0
  let polls = 0

  const ports = {
    auth: {
      requestDeviceCode: async () => over.requestCode ?? ok(CODE),
      poll: async () => script[polls++] ?? ok({ status: 'pending' as const }),
      identify: async () => over.identify ?? ok(IDENTITY)
    },
    tokens: {
      read: async () => ok(null),
      write: async (token: string) => {
        written.push(token)
        return over.write ?? ok(undefined)
      },
      clear: async () => {
        cleared += 1
        return ok(undefined)
      }
    },
    browser: { open: async () => {} },
    sleep: async (seconds: number) => {
      slept.push(seconds)
    }
  } as unknown as Ports

  return {
    ports,
    slept,
    written,
    codesShown,
    get cleared() {
      return cleared
    }
  } as Rig
}

describe('signIn — the happy path', () => {
  it('shows the code before anything else happens', async () => {
    const r = rig([ok({ status: 'granted', token: 'gho_x', scopes: ['public_repo'] })])
    const shown: DeviceCode[] = []
    await signIn(r.ports, { onCode: (c) => shown.push(c), isCancelled: () => false })
    expect(shown).toEqual([CODE])
  })

  it('waits before the first poll, as GitHub asks', async () => {
    const r = rig([ok({ status: 'granted', token: 'gho_x', scopes: ['public_repo'] })])
    await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(r.slept[0]).toBe(5)
  })

  it('polls until approval, then stores the token and rends the session', async () => {
    const r = rig([
      ok({ status: 'pending' }),
      ok({ status: 'pending' }),
      ok({ status: 'granted', token: 'gho_x', scopes: ['public_repo'] })
    ])
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(true)
    if (answer.ok) expect(answer.value.identity).toEqual(IDENTITY)
    expect(r.written).toEqual(['gho_x'])
    expect(r.slept).toEqual([5, 5, 5])
  })

  it('obeys slow_down by waiting longer, and keeps the new pace', async () => {
    const r = rig([
      ok({ status: 'slow-down' }),
      ok({ status: 'pending' }),
      ok({ status: 'granted', token: 'gho_x', scopes: ['repo'] })
    ])
    await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(r.slept).toEqual([5, 10, 10])
  })
})

describe('signIn — the ways it ends badly', () => {
  it('reports a refusal on GitHub, and stores nothing', async () => {
    const r = rig([ok({ status: 'denied' })])
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('auth/denied')
    expect(r.written).toEqual([])
  })

  it('reports an expiry announced by GitHub', async () => {
    const r = rig([ok({ status: 'expired' })])
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('auth/expired')
  })

  it('stops as soon as the panel is closed, without polling again', async () => {
    const r = rig([ok({ status: 'pending' }), ok({ status: 'granted', token: 'gho_x', scopes: ['repo'] })])
    let closed = false
    const answer = await signIn(r.ports, {
      onCode: () => {
        closed = true // the contributor gives up straight away
      },
      isCancelled: () => closed
    })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('auth/cancelled')
    expect(r.slept).toEqual([])
    expect(r.written).toEqual([])
  })

  it('refuses a token that cannot publish, rather than finding out later', async () => {
    const r = rig([ok({ status: 'granted', token: 'gho_x', scopes: ['gist'] })])
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(false)
    if (!answer.ok && answer.error.code === 'auth/missing-scope') {
      expect(answer.error.granted).toEqual(['gist'])
    }
    expect(r.written).toEqual([])
  })

  it('gives up when the code itself cannot be obtained', async () => {
    const r = rig([], { requestCode: fail({ code: 'auth/not-configured' }) })
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('auth/not-configured')
  })

  it('surfaces a storage failure instead of pretending to be signed in', async () => {
    const r = rig([ok({ status: 'granted', token: 'gho_x', scopes: ['public_repo'] })], {
      write: fail({ code: 'token/unwritable', cause: 'pas de trousseau' })
    })
    const answer = await signIn(r.ports, { onCode: () => {}, isCancelled: () => false })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('token/unwritable')
  })
})

describe('restoreSession', () => {
  it('rends null when no token was kept', async () => {
    const r = rig([])
    const answer = await restoreSession(r.ports)
    expect(answer).toEqual({ ok: true, value: null })
  })

  it('rends the session when the kept token is still honoured', async () => {
    const ports = { ...rig([]).ports, tokens: { read: async () => ok('gho_kept'), write: async () => ok(undefined), clear: async () => ok(undefined) } } as unknown as Ports
    const answer = await restoreSession(ports)
    expect(answer.ok).toBe(true)
    if (answer.ok) expect(answer.value?.identity).toEqual(IDENTITY)
  })

  it('drops a token GitHub no longer honours, rather than failing at every start', async () => {
    let cleared = 0
    const ports = {
      auth: { identify: async () => fail({ code: 'auth/github-refused', status: 401, body: 'bad credentials' }) },
      tokens: {
        read: async () => ok('gho_stale'),
        write: async () => ok(undefined),
        clear: async () => {
          cleared += 1
          return ok(undefined)
        }
      }
    } as unknown as Ports
    const answer = await restoreSession(ports)
    expect(answer).toEqual({ ok: true, value: null })
    expect(cleared).toBe(1)
  })
})

describe('signOut', () => {
  it('clears the stored token', async () => {
    let cleared = 0
    const ports = {
      tokens: { read: async () => ok(null), write: async () => ok(undefined), clear: async () => { cleared += 1; return ok(undefined) } }
    } as unknown as Ports
    expect((await signOut(ports)).ok).toBe(true)
    expect(cleared).toBe(1)
  })
})
