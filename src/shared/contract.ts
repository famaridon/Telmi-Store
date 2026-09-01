import type { DeviceCode, Session } from '@domain/auth'
import type { Result } from '@domain/errors'
import type { FileKind, LocalStory, PickedFile } from '@domain/model'

/**
 * The transport contract: the only surface through which the interface reaches
 * the system. Shared by main, preload and renderer, so changing a signature
 * breaks compilation of all three at once.
 *
 * It carries `Result<T>`, therefore an `AppError` as DATA. The French sentence
 * is produced by the renderer — see presentation/messages.ts.
 */
export interface Requests {
  'library:list': { params: void; result: LocalStory[] }

  /** Opens a native picker. Returns [] when the user cancels. */
  'files:pick': { params: { kind: FileKind; multiple: boolean }; result: PickedFile[] }
  /** Admits paths obtained by drag and drop. */
  'files:admit': { params: { paths: string[]; kind: FileKind }; result: PickedFile[] }
  /** Fetches a URL into the vault. Progress arrives as an event. */
  'files:fetch': { params: { url: string; kind: FileKind }; result: PickedFile }

  /**
   * Starts the Device Flow and resolves only once it is over — approved,
   * refused, expired or cancelled. The code to type arrives meanwhile as an
   * `auth:code` event, since the interface must show it without waiting.
   */
  'auth:signIn': { params: void; result: Session }
  /** Stops a sign-in in progress. */
  'auth:cancel': { params: void; result: void }
  /** Session restored from the kept token, or null. */
  'auth:restore': { params: void; result: Session | null }
  'auth:signOut': { params: void; result: void }
  /** Opens the GitHub page of the sign-in under way. Takes no URL, on purpose. */
  'auth:openVerification': { params: void; result: void }
}

export type Channel = keyof Requests
export type Params<C extends Channel> = Requests[C]['params']
export type Payload<C extends Channel> = Requests[C]['result']
export type Answer<C extends Channel> = Result<Payload<C>>

export const CHANNELS = [
  'library:list',
  'files:pick',
  'files:admit',
  'files:fetch',
  'auth:signIn',
  'auth:cancel',
  'auth:restore',
  'auth:signOut',
  'auth:openVerification'
] as const satisfies readonly Channel[]

/** Events pushed by the main process to the interface. */
export interface Events {
  'fetch:progress': { url: string; received: number; total: number | null }
  /** The code to type, as soon as GitHub hands it back. */
  'auth:code': DeviceCode
}

export type EventChannel = keyof Events
export const EVENT_CHANNELS = ['fetch:progress', 'auth:code'] as const satisfies readonly EventChannel[]

/** Scheme serving the picked files. See infrastructure/electronFileProtocol.ts. */
export const FILE_SCHEME = 'telmi-file'
