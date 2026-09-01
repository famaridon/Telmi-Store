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
}

export type Channel = keyof Requests
export type Params<C extends Channel> = Requests[C]['params']
export type Payload<C extends Channel> = Requests[C]['result']
export type Answer<C extends Channel> = Result<Payload<C>>

export const CHANNELS = ['library:list', 'files:pick', 'files:admit', 'files:fetch'] as const satisfies readonly Channel[]

/** Events pushed by the main process to the interface. */
export interface Events {
  'fetch:progress': { url: string; received: number; total: number | null }
}

export type EventChannel = keyof Events
export const EVENT_CHANNELS = ['fetch:progress'] as const satisfies readonly EventChannel[]

/** Scheme serving the picked files. See infrastructure/electronFileProtocol.ts. */
export const FILE_SCHEME = 'telmi-file'
