import type { FileKind, LocalStory, PickedFile } from './types'

/**
 * An error crossing the IPC boundary is always DESCRIBED, never thrown.
 *
 * Telmi-Sync swallows its store errors in a `console.log`: the user watches a
 * spinner turn forever without ever learning why. We do not reproduce that —
 * hence this type, imposed on every channel.
 *
 * `message` is user-facing French text, shown as-is.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: IpcError }

export interface IpcError {
  /** Stable code, meant for code. E.g. 'library/not-found'. */
  code: string
  /** Sentence shown to the user as-is, in French, saying what to do. */
  message: string
  /** Optional technical detail: path, HTTP status, underlying message. */
  detail?: string
}

/**
 * Request contract: the only surface through which the interface reaches the
 * system. The types are shared by all three targets, so changing a signature
 * breaks compilation of main, preload and renderer at once.
 */
export interface Requests {
  'library:list': { params: void; result: LocalStory[] }

  /** Opens a native picker. Returns [] when the user cancels. */
  'files:pick': { params: { kind: FileKind; multiple: boolean }; result: PickedFile[] }
  /** Describes paths obtained by drag and drop, and allows them for display. */
  'files:describe': { params: { paths: string[]; kind: FileKind }; result: PickedFile[] }
  /** Downloads a URL into a work directory. Progress comes as an event. */
  'files:download': { params: { url: string; kind: FileKind }; result: PickedFile }
}

export type Channel = keyof Requests
export type Params<C extends Channel> = Requests[C]['params']
export type ResultOf<C extends Channel> = Requests[C]['result']

export const CHANNELS = [
  'library:list',
  'files:pick',
  'files:describe',
  'files:download'
] as const satisfies readonly Channel[]

/** Contract of the events pushed by the main process to the interface. */
export interface Events {
  'download:progress': { url: string; received: number; total: number | null }
}

export type EventChannel = keyof Events
export const EVENT_CHANNELS = ['download:progress'] as const satisfies readonly EventChannel[]

/** Accepted extensions, for the picker as well as for drag and drop. */
export const EXTENSIONS: Record<FileKind, readonly string[]> = {
  audio: ['mp3'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
}

/** Scheme serving the files the contributor picked. See src/main/protocol.ts. */
export const FILE_SCHEME = 'telmi-file'
