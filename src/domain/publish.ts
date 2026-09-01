import type { StoreEntry, Submission } from './model'
import type { BuiltPack } from './pack'

/**
 * Publishing a pack, as the domain describes it.
 *
 * These types sit here rather than in the application layer because the
 * transport contract carries them, and the interface reads them — and the
 * interface is not allowed to reach into the application. Moving them here was
 * the architecture barrier's answer, and it is the right one: « what a
 * publication needs » and « what it produced » are vocabulary, not orchestration.
 */
export interface PublishRequest {
  submission: Submission
  pack: BuiltPack
  /** Kept across versions, or Telmi-Sync sees an unrelated story. */
  uuid: string
  version: number
  /** The signed-in login, which signs the rights declaration. */
  login: string
}

export interface Published {
  entry: StoreEntry
  /** Where the world can now fetch the pack. */
  url: string
  repo: string
  tag: string
}
