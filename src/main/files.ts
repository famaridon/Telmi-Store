import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { Result } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { FileKind, PickedFile } from '@shared/types'

/**
 * Table of the files the contributor explicitly picked. It is the only way in
 * for the `telmi-file://` protocol: the interface handles ids, never paths.
 */
const allowed = new Map<string, string>()

export const allowedPath = (id: string): string | null => allowed.get(id) ?? null

const extensionAccepted = (path: string, kind: FileKind): boolean =>
  EXTENSIONS[kind].includes(extname(path).slice(1).toLowerCase())

/** Allows a path and returns its description, or an explicit error. */
export const describe = async (path: string, kind: FileKind, url?: string): Promise<Result<PickedFile>> => {
  if (!extensionAccepted(path, kind)) {
    const expected = EXTENSIONS[kind].join(', ')
    return {
      ok: false,
      error: {
        code: 'file/extension',
        message: `« ${basename(path)} » n'est pas un fichier accepté. Attendu : ${expected}.`,
        detail: path
      }
    }
  }

  let bytes: number
  try {
    const info = await stat(path)
    if (!info.isFile()) {
      return {
        ok: false,
        error: { code: 'file/not-a-file', message: `« ${basename(path)} » n'est pas un fichier.`, detail: path }
      }
    }
    bytes = info.size
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'file/unreadable',
        message: `Impossible de lire « ${basename(path)} ». Vérifie qu'il existe toujours.`,
        detail: e instanceof Error ? e.message : String(e)
      }
    }
  }

  if (bytes === 0) {
    return {
      ok: false,
      error: { code: 'file/empty', message: `« ${basename(path)} » est vide.`, detail: path }
    }
  }

  const id = randomUUID()
  allowed.set(id, path)
  return {
    ok: true,
    value: { id, name: basename(path), bytes, from: url ? 'url' : 'disk', ...(url ? { url } : {}) }
  }
}

/** Describes several paths; a single failure fails the whole batch. */
export const describeAll = async (paths: string[], kind: FileKind): Promise<Result<PickedFile[]>> => {
  const files: PickedFile[] = []
  for (const path of paths) {
    const r = await describe(path, kind)
    if (!r.ok) return r
    files.push(r.value)
  }
  return { ok: true, value: files }
}
