import type { PollOutcome } from '../auth'
import { REQUIRED_SCOPE } from '../auth'

/**
 * The polling policy, as a pure decision.
 *
 * Waiting is I/O, but *deciding whether and how long to wait* is a rule — and
 * the interesting cases are easy to get wrong: GitHub answers `slow_down` when
 * polled too fast and expects the interval to grow, and an attempt that outlives
 * `expiresIn` must stop rather than poll a dead code forever.
 */

/** GitHub's documented penalty for polling too fast. */
const SLOW_DOWN_PENALTY_SECONDS = 5

export type PollPlan =
  /** Wait, then poll again. */
  | { action: 'retry'; waitSeconds: number; intervalSeconds: number }
  /** Approved: stop here. */
  | { action: 'done'; token: string; scopes: string[] }
  /** Over, and why. */
  | { action: 'abandon'; reason: 'expired' | 'denied' }

export interface PollContext {
  /** The interval currently observed, in seconds. */
  intervalSeconds: number
  /** Seconds since the attempt started. */
  elapsedSeconds: number
  /** Lifetime GitHub granted the attempt. */
  expiresInSeconds: number
}

export const planNextPoll = (outcome: PollOutcome, context: PollContext): PollPlan => {
  switch (outcome.status) {
    case 'granted':
      return { action: 'done', token: outcome.token, scopes: outcome.scopes }
    case 'denied':
      return { action: 'abandon', reason: 'denied' }
    case 'expired':
      return { action: 'abandon', reason: 'expired' }
    case 'slow-down': {
      const intervalSeconds = context.intervalSeconds + SLOW_DOWN_PENALTY_SECONDS
      return context.elapsedSeconds + intervalSeconds >= context.expiresInSeconds
        ? { action: 'abandon', reason: 'expired' }
        : { action: 'retry', waitSeconds: intervalSeconds, intervalSeconds }
    }
    case 'pending':
      // Stop before polling a code we know will already be dead.
      return context.elapsedSeconds + context.intervalSeconds >= context.expiresInSeconds
        ? { action: 'abandon', reason: 'expired' }
        : { action: 'retry', waitSeconds: context.intervalSeconds, intervalSeconds: context.intervalSeconds }
    default:
      return { action: 'abandon', reason: 'expired' }
  }
}

/**
 * `public_repo` is implied by `repo`, so a token carrying the broader scope is
 * accepted rather than refused for not matching the exact string.
 */
export const hasRequiredScope = (scopes: string[]): boolean =>
  scopes.includes(REQUIRED_SCOPE) || scopes.includes('repo')

/** Splits the scope list GitHub returns, which is comma or space separated. */
export const parseScopes = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope !== '')
