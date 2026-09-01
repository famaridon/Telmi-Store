import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, safeStorage } from 'electron'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { TokenStore } from '@domain/ports'

/**
 * The token, encrypted by the operating system keychain.
 *
 * `safeStorage` uses the Keychain on macOS, DPAPI on Windows, and the desktop
 * secret service on Linux. When it reports no encryption available — a Linux
 * session without a keyring — we refuse to write rather than leave a token in
 * clear text on disk: being asked to sign in again is a smaller harm.
 *
 * The token never crosses the IPC boundary: the renderer learns who is signed
 * in, never with what.
 */
export const createElectronTokenStore = (path?: string): TokenStore => {
  const file = path ?? join(app.getPath('userData'), 'github.token')

  return {
    async read(): Promise<Result<string | null>> {
      let encrypted: Buffer
      try {
        encrypted = await readFile(file)
      } catch {
        return ok(null)
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return fail({ code: 'token/unreadable', cause: 'chiffrement indisponible' })
      }
      try {
        return ok(safeStorage.decryptString(encrypted))
      } catch (e) {
        // Unreadable usually means another machine or another user wrote it.
        await rm(file, { force: true })
        return ok(null)
      }
    },

    async write(token: string): Promise<Result<void>> {
      if (!safeStorage.isEncryptionAvailable()) {
        return fail({ code: 'token/unwritable', cause: 'chiffrement indisponible' })
      }
      try {
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, safeStorage.encryptString(token), { mode: 0o600 })
        return ok(undefined)
      } catch (e) {
        return fail({ code: 'token/unwritable', cause: causeOf(e) })
      }
    },

    async clear(): Promise<Result<void>> {
      try {
        await rm(file, { force: true })
        return ok(undefined)
      } catch (e) {
        return fail({ code: 'token/unwritable', cause: causeOf(e) })
      }
    }
  }
}
