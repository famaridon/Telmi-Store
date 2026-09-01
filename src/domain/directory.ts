/**
 * The directory of stores.
 *
 * It exists for one measured reason: the English and Chinese stores have been
 * alive for a year and **no user has ever seen them**, because their URL is
 * buried in a wiki page. A store nobody can find receives no contribution.
 *
 * The directory is a file fetched at start-up, so adding a store is one pull
 * request rather than a new release of this application.
 */
export interface StoreListing {
  /** « owner/name » of the store repository. */
  repo: string
  name: string
  /** Two-letter code, for grouping. */
  language: string
  description: string
  /** Where Telmi-Sync should be pointed, for whoever wants to add it there too. */
  indexUrl: string
}

/**
 * The directory as the interface receives it: what exists, and what is aimed at.
 *
 * Here rather than in the application layer for the same reason as `Published`
 * and `ProposeRequest`: the transport contract carries it, the interface reads
 * it, and the interface may not reach into the application. Third time the
 * layer barrier gave that answer, and it is the right one — a type that crosses
 * the boundary is vocabulary.
 */
export interface KnownStores {
  listings: StoreListing[]
  /** « owner/name » of the store every proposal and moderation acts on. */
  chosen: string
}
