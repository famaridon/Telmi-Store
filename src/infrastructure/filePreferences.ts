import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { Preferences } from '@domain/ports'

/**
 * The few choices worth remembering, in one small JSON file.
 *
 * Nothing here is precious: losing the file means being asked again which store
 * to propose to. So a read never fails — it rends nothing — and only a write
 * reports a problem.
 */
interface Stored {
  chosenStore?: string
}

export const createFilePreferences = (path?: string): Preferences => {
  const file = path ?? join(app.getPath('userData'), 'preferences.json')

  const read = async (): Promise<Stored> => {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Stored
    } catch {
      return {}
    }
  }

  return {
    async chosenStore(): Promise<string | null> {
      return (await read()).chosenStore ?? null
    },

    async chooseStore(repo: string): Promise<Result<void>> {
      try {
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, JSON.stringify({ ...(await read()), chosenStore: repo }, null, 2))
        return ok(undefined)
      } catch (e) {
        return fail({ code: 'preferences/unwritable', cause: causeOf(e) })
      }
    }
  }
}
