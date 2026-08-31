import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { Result } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { FileKind, PickedFile } from '@shared/types'
import { describe } from './files'

/** Work directory, wiped on the next start. */
const workDir = join(tmpdir(), 'telmi-store-work')

const ACCEPTED_TYPES: Record<FileKind, readonly string[]> = {
  audio: ['audio/mpeg', 'audio/mp3'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
}

/** A readable file name, derived from the URL then from the announced type. */
const nameFromUrl = (url: string, type: string, kind: FileKind): string => {
  let base = 'telechargement'
  try {
    const path = new URL(url).pathname
    const raw = decodeURIComponent(basename(path))
    if (raw && raw !== '/') base = raw
  } catch {
    /* invalid URL: the default name will do */
  }
  const extension = extname(base).slice(1).toLowerCase()
  if (EXTENSIONS[kind].includes(extension)) return base
  return base.replace(/\.[^.]*$/, '') + (EXTENSION_BY_TYPE[type] ?? '.' + EXTENSIONS[kind][0])
}

/** Called as the download proceeds. `total` is null when the server omits it. */
export type OnProgress = (received: number, total: number | null) => void

export const download = async (
  url: string,
  kind: FileKind,
  onProgress: OnProgress = () => {}
): Promise<Result<PickedFile>> => {
  let address: URL
  try {
    address = new URL(url)
  } catch {
    return { ok: false, error: { code: 'url/invalid', message: "Cette adresse n'est pas une URL valide.", detail: url } }
  }
  if (address.protocol !== 'https:' && address.protocol !== 'http:') {
    return {
      ok: false,
      error: { code: 'url/protocol', message: 'Seules les adresses http et https sont acceptées.', detail: address.protocol }
    }
  }

  let response: Response
  try {
    // 60 s to answer: beyond that we prefer a message to a spinner.
    response = await fetch(address, { signal: AbortSignal.timeout(60_000), redirect: 'follow' })
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'url/unreachable',
        message: 'Cette adresse ne répond pas. Vérifie le lien et ta connexion.',
        detail: e instanceof Error ? e.message : String(e)
      }
    }
  }

  if (!response.ok || response.body === null) {
    return {
      ok: false,
      error: {
        code: 'url/status',
        message: `Le serveur a répondu ${response.status}. Le lien est peut-être expiré ou privé.`,
        detail: `${response.status} ${response.statusText} — ${url}`
      }
    }
  }

  const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (type !== '' && !ACCEPTED_TYPES[kind].includes(type)) {
    const expected = kind === 'audio' ? 'un mp3' : 'une image'
    return {
      ok: false,
      error: {
        code: 'url/wrong-type',
        message: `Cette adresse ne renvoie pas ${expected} mais « ${type} ».`,
        detail: url
      }
    }
  }

  const total = Number(response.headers.get('content-length')) || null
  const target = join(workDir, randomUUID(), nameFromUrl(url, type, kind))

  try {
    await mkdir(join(target, '..'), { recursive: true })
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'work-dir/failed',
        message: 'Impossible de créer le dossier de travail.',
        detail: e instanceof Error ? e.message : String(e)
      }
    }
  }

  let received = 0
  let lastReport = 0
  const stream = Readable.fromWeb(response.body as never)
  stream.on('data', (chunk: Buffer) => {
    received += chunk.length
    // Do not flood the interface: at most one report every 120 ms.
    const now = Date.now()
    if (now - lastReport < 120) return
    lastReport = now
    onProgress(received, total)
  })

  try {
    await pipeline(stream, createWriteStream(target))
  } catch (e) {
    await rm(join(target, '..'), { recursive: true, force: true })
    return {
      ok: false,
      error: {
        code: 'url/interrupted',
        message: 'Le téléchargement a été interrompu. Réessaie.',
        detail: e instanceof Error ? e.message : String(e)
      }
    }
  }

  onProgress(received, total ?? received)
  return describe(target, kind, url)
}

/** Wipes the work directory: downloads do not outlive the session. */
export const clearWorkDir = async (): Promise<void> => {
  await rm(workDir, { recursive: true, force: true })
}
