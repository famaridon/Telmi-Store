import { describe, expect, it } from 'vitest'
import type { PollOutcome } from '@domain/auth'
import { hasRequiredScope, parseScopes, planNextPoll, type PollContext } from '@domain/rules/auth'

const context = (over: Partial<PollContext> = {}): PollContext => ({
  intervalSeconds: 5,
  elapsedSeconds: 0,
  expiresInSeconds: 900,
  ...over
})

describe('planNextPoll — the ordinary course', () => {
  it('keeps polling at the same pace while nobody has approved', () => {
    expect(planNextPoll({ status: 'pending' }, context())).toEqual({
      action: 'retry',
      waitSeconds: 5,
      intervalSeconds: 5
    })
  })

  it('stops on approval and carries the token through', () => {
    const outcome: PollOutcome = { status: 'granted', token: 'gho_x', scopes: ['public_repo'] }
    expect(planNextPoll(outcome, context())).toEqual({
      action: 'done',
      token: 'gho_x',
      scopes: ['public_repo']
    })
  })
})

describe('planNextPoll — slowing down when told to', () => {
  it('adds five seconds to the interval, as GitHub documents', () => {
    expect(planNextPoll({ status: 'slow-down' }, context({ intervalSeconds: 5 }))).toEqual({
      action: 'retry',
      waitSeconds: 10,
      intervalSeconds: 10
    })
  })

  it('keeps the widened interval for the polls that follow', () => {
    const first = planNextPoll({ status: 'slow-down' }, context({ intervalSeconds: 5 }))
    expect(first.action).toBe('retry')
    if (first.action !== 'retry') return
    // The next pending answer must not silently fall back to five seconds.
    expect(planNextPoll({ status: 'pending' }, context({ intervalSeconds: first.intervalSeconds }))).toEqual({
      action: 'retry',
      waitSeconds: 10,
      intervalSeconds: 10
    })
  })
})

describe('planNextPoll — giving up', () => {
  it('reports a refusal as such', () => {
    expect(planNextPoll({ status: 'denied' }, context())).toEqual({ action: 'abandon', reason: 'denied' })
  })

  it('reports an expiry announced by GitHub', () => {
    expect(planNextPoll({ status: 'expired' }, context())).toEqual({ action: 'abandon', reason: 'expired' })
  })

  it('stops on its own rather than polling a code it knows is dead', () => {
    // 897 s elapsed of a 900 s life, and five more to wait: pointless.
    expect(planNextPoll({ status: 'pending' }, context({ elapsedSeconds: 897 }))).toEqual({
      action: 'abandon',
      reason: 'expired'
    })
  })

  it('accounts for the widened interval when deciding it is too late', () => {
    expect(
      planNextPoll({ status: 'slow-down' }, context({ intervalSeconds: 5, elapsedSeconds: 893 }))
    ).toEqual({ action: 'abandon', reason: 'expired' })
  })

  it('keeps going while there is still room for one more poll', () => {
    expect(planNextPoll({ status: 'pending' }, context({ elapsedSeconds: 800 })).action).toBe('retry')
  })
})

describe('hasRequiredScope', () => {
  it('accepts the scope we ask for', () => {
    expect(hasRequiredScope(['public_repo'])).toBe(true)
  })

  it('accepts the broader scope that implies it', () => {
    expect(hasRequiredScope(['repo'])).toBe(true)
  })

  it('refuses a token that cannot publish', () => {
    expect(hasRequiredScope([])).toBe(false)
    expect(hasRequiredScope(['read:user', 'gist'])).toBe(false)
  })
})

describe('parseScopes', () => {
  it('reads both separators GitHub uses', () => {
    expect(parseScopes('public_repo,gist')).toEqual(['public_repo', 'gist'])
    expect(parseScopes('public_repo gist')).toEqual(['public_repo', 'gist'])
    expect(parseScopes('public_repo, gist')).toEqual(['public_repo', 'gist'])
  })

  it('rends an empty list rather than a list of nothing', () => {
    expect(parseScopes('')).toEqual([])
    expect(parseScopes('   ')).toEqual([])
  })
})
