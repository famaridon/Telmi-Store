import type { FileKind } from './model'

/**
 * Every failure the application can describe, as data.
 *
 * Deliberately NOT a sentence. Telmi-Sync swallows its store errors in a
 * `console.log` and leaves the user watching a spinner forever; we go the other
 * way, but the wording belongs to the presentation layer, not here. A single
 * file turns these into French sentences — see renderer/presentation/messages.ts
 * — which makes every message auditable in one place and testable.
 */
export type AppError =
  | { code: 'library/not-found'; path: string; cause: string }
  | { code: 'file/bad-extension'; name: string; kind: FileKind }
  | { code: 'file/not-a-file'; name: string }
  | { code: 'file/unreadable'; name: string; cause: string }
  | { code: 'file/empty'; name: string }
  | { code: 'url/invalid'; url: string }
  | { code: 'url/bad-protocol'; protocol: string }
  | { code: 'url/unreachable'; cause: string }
  | { code: 'url/status'; status: number; statusText: string; url: string }
  | { code: 'url/wrong-type'; type: string; kind: FileKind }
  | { code: 'url/interrupted'; cause: string }
  | { code: 'workdir/unavailable'; cause: string }
  | { code: 'ui/no-window' }
  | { code: 'ipc/unknown-channel'; channel: string }
  | { code: 'internal/unexpected'; cause: string }

export type ErrorCode = AppError['code']

/** A failure is returned, never thrown. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = <T = never>(error: AppError): Result<T> => ({ ok: false, error })

/** Turns anything caught into a cause string, without leaking a stack trace. */
export const causeOf = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : String(e)
