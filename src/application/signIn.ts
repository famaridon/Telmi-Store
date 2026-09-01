import type { DeviceCode, Session } from '@domain/auth'
import { fail, ok, type Result } from '@domain/errors'
import type { Ports } from '@domain/ports'
import { hasRequiredScope, planNextPoll } from '@domain/rules/auth'

/**
 * The sign-in flow, orchestrated through ports only.
 *
 * `onCode` fires as soon as GitHub hands back the pair of codes — before the
 * contributor has done anything — because the interface must show the code
 * immediately and then wait alongside us.
 *
 * `isCancelled` is checked between two polls: closing the panel must stop the
 * loop rather than leave it running until the code expires.
 */
export interface SignInHooks {
  onCode: (code: DeviceCode) => void
  isCancelled: () => boolean
}

export const signIn = async (ports: Ports, hooks: SignInHooks): Promise<Result<Session>> => {
  const requested = await ports.auth.requestDeviceCode()
  if (!requested.ok) return requested

  const code = requested.value
  hooks.onCode(code)

  let intervalSeconds = code.interval
  let elapsedSeconds = 0

  // GitHub asks not to poll before the first interval has passed.
  for (;;) {
    if (hooks.isCancelled()) return fail({ code: 'auth/cancelled' })
    await ports.sleep(intervalSeconds)
    elapsedSeconds += intervalSeconds
    if (hooks.isCancelled()) return fail({ code: 'auth/cancelled' })

    const polled = await ports.auth.poll(code.deviceCode)
    if (!polled.ok) return polled

    const plan = planNextPoll(polled.value, {
      intervalSeconds,
      elapsedSeconds,
      expiresInSeconds: code.expiresIn
    })

    if (plan.action === 'abandon') {
      return fail(plan.reason === 'denied' ? { code: 'auth/denied' } : { code: 'auth/expired' })
    }

    if (plan.action === 'retry') {
      intervalSeconds = plan.intervalSeconds
      continue
    }

    // Approved. Refuse a token that cannot do the job rather than discovering it
    // later, in the middle of a publication.
    if (!hasRequiredScope(plan.scopes)) {
      return fail({ code: 'auth/missing-scope', granted: plan.scopes })
    }

    const identified = await ports.auth.identify(plan.token)
    if (!identified.ok) return identified

    const stored = await ports.tokens.write(plan.token)
    if (!stored.ok) return stored

    return ok({ identity: identified.value, scopes: plan.scopes })
  }
}

/** Reads back a session from a token kept between two runs. Null if none. */
export const restoreSession = async (ports: Ports): Promise<Result<Session | null>> => {
  const read = await ports.tokens.read()
  if (!read.ok) return read
  if (read.value === null) return ok(null)

  const identified = await ports.auth.identify(read.value)
  if (!identified.ok) {
    // A token GitHub no longer honours is worse than no token: drop it so the
    // contributor is offered a clean sign-in instead of a recurring failure.
    await ports.tokens.clear()
    return ok(null)
  }
  return ok({ identity: identified.value, scopes: [] })
}

export const signOut = async (ports: Ports): Promise<Result<void>> => ports.tokens.clear()
