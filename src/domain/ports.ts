import type { AppError, Result } from './errors'
import type { FileKind, LocalStory, PickedFile } from './model'

/**
 * What the application needs from the outside world, expressed as interfaces it
 * owns. Adapters live in src/infrastructure and depend on these; nothing here
 * depends on them.
 */

/** Telmi-Sync's library. Read-only: we never write into it. */
export interface StoryLibrary {
  list(): Promise<Result<LocalStory[]>>
}

/**
 * Keeper of the files the contributor picked. Holds the capability table that
 * the `telmi-file://` protocol reads, and is the only component that knows a path.
 */
export interface FileVault {
  /** Registers a path and describes it, or explains why it is unusable. */
  admit(path: string, kind: FileKind, url?: string): Promise<Result<PickedFile>>
  /** Resolves an id granted by `admit`. Null for anything else. */
  resolve(id: string): string | null
  /** Absolute path of a fresh, unique file to write into. */
  reserve(name: string): Promise<Result<string>>
  /** Forgets and deletes everything written through `reserve`. */
  clear(): Promise<void>
}

/** Asks the user for files. Implemented with the native dialog. */
export interface FilePicker {
  pick(kind: FileKind, multiple: boolean): Promise<Result<PickedFile[]>>
}

export type ProgressReport = (received: number, total: number | null) => void

/** Fetches a remote file into the vault. */
export interface Fetcher {
  fetchInto(url: string, kind: FileKind, onProgress: ProgressReport): Promise<Result<PickedFile>>
}

/** Everything the use cases need, gathered so the composition root wires it once. */
export interface Ports {
  library: StoryLibrary
  vault: FileVault
  picker: FilePicker
  fetcher: Fetcher
}

export type { AppError, Result }
