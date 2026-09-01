import type { StoreListing } from '../directory'

/**
 * Reading the directory, tolerantly.
 *
 * A malformed entry is dropped rather than allowed to break the screen: the
 * directory is a file anybody can propose a change to, so a typo in it must cost
 * one missing line, not a blank application.
 */
const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** « owner/name », and nothing that could be a path or a URL. */
const REPO = /^[\w.-]+\/[\w.-]+$/

export const readDirectory = (raw: unknown): StoreListing[] => {
  const entries = typeof raw === 'object' && raw !== null && Array.isArray((raw as { stores?: unknown }).stores)
    ? ((raw as { stores: unknown[] }).stores)
    : Array.isArray(raw)
      ? raw
      : []

  const listings: StoreListing[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const repo = asString(record['depot'])
    if (!REPO.test(repo) || seen.has(repo)) continue
    seen.add(repo)

    const indexUrl = asString(record['index'])
    listings.push({
      repo,
      name: asString(record['nom']) || repo,
      language: asString(record['langue']).slice(0, 5),
      description: asString(record['description']),
      // A sensible default rather than nothing: the index of a store repository
      // sits at its root, on the default branch.
      indexUrl: indexUrl !== '' ? indexUrl : `https://raw.githubusercontent.com/${repo}/main/index.json`
    })
  }
  return listings
}

/** Stores grouped by language, the languages in alphabetical order. */
export const byLanguage = (listings: StoreListing[]): { language: string; stores: StoreListing[] }[] => {
  const groups = new Map<string, StoreListing[]>()
  for (const listing of listings) {
    const key = listing.language === '' ? 'zz' : listing.language
    groups.set(key, [...(groups.get(key) ?? []), listing])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([language, stores]) => ({
      language: language === 'zz' ? '' : language,
      stores: [...stores].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    }))
}

/**
 * The store a proposal goes to.
 *
 * The one that was chosen, if it is still in the directory; otherwise the first
 * one — so a store that disappears does not leave the application aiming at
 * nothing.
 */
export const storeToUse = (listings: StoreListing[], chosen: string | null): string | null => {
  if (chosen !== null && listings.some((listing) => listing.repo === chosen)) return chosen
  return listings[0]?.repo ?? null
}
