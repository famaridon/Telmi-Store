import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { StoreListing } from '@domain/directory'
import type { StoreDirectory } from '@domain/ports'
import { readDirectory } from '@domain/rules/directory'

/**
 * The directory, fetched from a file rather than compiled in.
 *
 * That is the whole point: adding a store must cost one pull request on that
 * file, not a new release of this application. Otherwise a new store stays
 * invisible until someone ships a build — which is exactly how the English and
 * Chinese stores went a year without a single user seeing them.
 */
export const createHttpStoreDirectory = (url: string): StoreDirectory => ({
  async list(): Promise<Result<StoreListing[]>> {
    let response: Response
    try {
      response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    } catch (e) {
      return fail({ code: 'directory/unreachable', url, cause: causeOf(e) })
    }
    if (!response.ok) {
      return fail({ code: 'directory/unreachable', url, cause: `HTTP ${response.status}` })
    }

    let listings: StoreListing[]
    try {
      listings = readDirectory(await response.json())
    } catch (e) {
      return fail({ code: 'directory/unreachable', url, cause: causeOf(e) })
    }
    if (listings.length === 0) return fail({ code: 'directory/empty', url })
    return ok(listings)
  }
})
