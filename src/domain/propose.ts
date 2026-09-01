import type { StoreEntry } from './model'
import type { PackFile } from './ports'

/**
 * Proposing an entry to a store, as the domain describes it.
 *
 * What crosses is small on purpose: a two-kilo-octet entry and a thumbnail. The
 * pack itself stays in the contributor's own repository — the store only ever
 * receives an address.
 */
export interface ProposeRequest {
  /** « owner/name » of the store repository. */
  storeRepo: string
  entry: StoreEntry
  /** The entry file and its thumbnail, already produced. */
  files: PackFile[]
  /**
   * Title and body of the pull request.
   *
   * They come from the interface because they are French prose read by a human,
   * and French belongs to the presentation layer. The domain decides what is
   * proposed; how it is worded is not its business.
   */
  title: string
  body: string
}

export interface Proposed {
  url: string
  number: number
  branch: string
  /** The fork the branch lives on, « owner/name ». */
  fork: string
  /** True when the proposal already existed and was updated. */
  updated: boolean
}
