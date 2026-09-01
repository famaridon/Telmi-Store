import { fail, ok, type Result } from '@domain/errors'
import type { KnownStores } from '@domain/directory'
import type { Ports } from '@domain/ports'
import { storeToUse } from '@domain/rules/directory'

export const knownStores = async (ports: Ports): Promise<Result<KnownStores>> => {
  const listings = await ports.directory.list()
  if (!listings.ok) return listings

  const chosen = storeToUse(listings.value, await ports.preferences.chosenStore())
  if (chosen === null) return fail({ code: 'directory/empty', url: '' })
  return ok({ listings: listings.value, chosen })
}

export const chooseStore = (ports: Ports, repo: string): Promise<Result<void>> =>
  ports.preferences.chooseStore(repo)

/**
 * The store every proposal and every moderation acts on.
 *
 * Resolved here rather than held as a constant, so the choice made on the
 * store-picking screen actually governs what the other screens do.
 */
export const currentStore = async (ports: Ports): Promise<Result<string>> => {
  const known = await knownStores(ports)
  return known.ok ? ok(known.value.chosen) : known
}
