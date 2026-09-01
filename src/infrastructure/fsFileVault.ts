import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { FileKind, PickedFile } from '@domain/model'
import type { FileVault } from '@domain/ports'
import { acceptsExtension } from '@domain/rules/files'

/**
 * Keeper of the picked files.
 *
 * It holds the only mapping from an opaque id to a real path. Everything the
 * interface can display or play goes through here, so nothing it was not
 * explicitly given can be reached — no path, no directory traversal.
 */
export const createFsFileVault = (workRoot = join(tmpdir(), 'telmi-store-work')): FileVault => {
  const admitted = new Map<string, string>()

  return {
    async admit(path: string, kind: FileKind, url?: string): Promise<Result<PickedFile>> {
      const name = basename(path)

      if (!acceptsExtension(name, kind)) {
        return fail({ code: 'file/bad-extension', name, kind })
      }

      let bytes: number
      try {
        const info = await stat(path)
        if (!info.isFile()) return fail({ code: 'file/not-a-file', name })
        bytes = info.size
      } catch (e) {
        return fail({ code: 'file/unreadable', name, cause: causeOf(e) })
      }

      if (bytes === 0) return fail({ code: 'file/empty', name })

      const id = randomUUID()
      admitted.set(id, path)
      return ok({ id, name, bytes, from: url ? 'url' : 'disk', ...(url ? { url } : {}) })
    },

    resolve(id: string): string | null {
      return admitted.get(id) ?? null
    },

    async reserve(name: string): Promise<Result<string>> {
      const directory = join(workRoot, randomUUID())
      try {
        await mkdir(directory, { recursive: true })
      } catch (e) {
        return fail({ code: 'workdir/unavailable', cause: causeOf(e) })
      }
      return ok(join(directory, name))
    },

    async clear(): Promise<void> {
      admitted.clear()
      await rm(workRoot, { recursive: true, force: true })
    }
  }
}
