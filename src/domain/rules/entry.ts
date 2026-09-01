import type { RightsStatus, Submission } from '../model'
import type { PackLocation, StoreEntry } from '../model'
import { slugify } from './pack'

/**
 * The store entry: the two kilo-octets a moderator actually reads.
 *
 * Careful with the names. The published JSON uses FRENCH keys — `titre`,
 * `droits.declare_par`, `pack.depot` — because that file is the contract a
 * contributor reads and a maintainer reviews, and the store's own checker
 * expects them. The code stays in English, so the crossing happens in one place:
 * `entryToJson` below. Nowhere else should know both vocabularies.
 */

/** The five statuses, as the published file spells them. */
const STATUS_IN_FILE: Record<RightsStatus, string> = {
  'own-work': 'cree-par-le-contributeur',
  'public-domain': 'domaine-public',
  'cc-by': 'cc-by',
  'cc-by-sa': 'cc-by-sa',
  'written-permission': 'autorisation-ecrite'
}

/** The name of a story's files inside the store repository. */
export const entrySlug = (title: string): string => slugify(title)

export interface EntryIdentity {
  uuid: string
  version: number
  /** The GitHub login that signs the declaration. */
  declaredBy: string
}

export const buildEntry = (
  submission: Submission,
  identity: EntryIdentity,
  pack: PackLocation
): StoreEntry => ({
  slug: entrySlug(submission.title),
  title: submission.title,
  minAge: submission.minAge,
  category: submission.category,
  language: submission.language,
  description: submission.description,
  uuid: identity.uuid,
  version: identity.version,
  rights: {
    // The form blocks on an empty status, so it is set by the time we get here.
    status: (submission.rights.status || 'own-work') as RightsStatus,
    source: submission.rights.source.trim(),
    declaredBy: identity.declaredBy
  },
  pack
})

/** The tag of a release, which must never be mutable. */
export const releaseTag = (slug: string, version: number): string => `${slug}-${version}.0.0`

/** The archive file name inside the release. */
export const releaseFileName = (slug: string): string => `${slug}.zip`

/** The shape written to histoires/<slug>.json in the store repository. */
export const entryToJson = (entry: StoreEntry): Record<string, unknown> => {
  const pack: Record<string, unknown> = { type: '' }

  switch (entry.pack.kind) {
    case 'release':
      pack['type'] = 'pack-release'
      pack['depot'] = entry.pack.repo
      pack['tag'] = entry.pack.tag
      pack['fichier'] = entry.pack.file
      pack['sha256'] = entry.pack.sha256
      pack['taille'] = entry.pack.bytes
      break
    case 'external':
      pack['type'] = 'pack-externe'
      pack['url'] = entry.pack.url
      pack['sha256'] = entry.pack.sha256
      pack['taille'] = entry.pack.bytes
      break
    case 'repo-archive':
      pack['type'] = 'pack-depot'
      pack['depot'] = entry.pack.repo
      if (entry.pack.branch !== undefined) pack['branche'] = entry.pack.branch
      pack['sha256'] = entry.pack.sha256
      pack['taille'] = entry.pack.bytes
      break
  }

  return {
    slug: entry.slug,
    titre: entry.title,
    age: entry.minAge,
    categorie: entry.category,
    langue: entry.language,
    description: entry.description,
    uuid: entry.uuid,
    version: entry.version,
    droits: {
      statut: STATUS_IN_FILE[entry.rights.status],
      source: entry.rights.source,
      declare_par: entry.rights.declaredBy
    },
    pack
  }
}

/** The file name the entry must be written under, or the checker refuses it. */
export const entryFileName = (entry: StoreEntry): string => `histoires/${entry.slug}.json`

/** And the thumbnail beside it, which the checker also demands. */
export const thumbnailFileName = (entry: StoreEntry): string => `vignettes/${entry.slug}.png`
