import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LocalStory } from '@shared/types'
import type { Result } from '@shared/ipc'

/**
 * Telmi-Sync's library. Read-only: this application never modifies ~/.telmi,
 * which belongs to Telmi-Sync.
 */
const libraryPath = (): string => join(homedir(), '.telmi', 'stories')

interface PackMetadata {
  title?: string
  uuid?: string
  version?: number
  age?: number
  category?: string
  description?: string
}

/** Size and file count of a directory, walking it recursively. */
const weigh = async (path: string): Promise<{ bytes: number; fileCount: number }> => {
  let bytes = 0
  let fileCount = 0
  const entries = await readdir(path, { withFileTypes: true })
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      const r = await weigh(child)
      bytes += r.bytes
      fileCount += r.fileCount
    } else if (entry.isFile()) {
      bytes += (await stat(child)).size
      fileCount += 1
    }
  }
  return { bytes, fileCount }
}

export const listLibrary = async (): Promise<Result<LocalStory[]>> => {
  const root = libraryPath()

  let directories: string[]
  try {
    directories = (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'library/not-found',
        message:
          "Aucune bibliothèque Telmi-Sync n'a été trouvée. Installe et lance Telmi-Sync " +
          'au moins une fois, puis reviens ici.',
        detail: `${root} — ${e instanceof Error ? e.message : String(e)}`
      }
    }
  }

  const stories: LocalStory[] = []
  for (const directory of directories) {
    const path = join(root, directory)
    let metadata: PackMetadata
    try {
      metadata = JSON.parse(await readFile(join(path, 'metadata.json'), 'utf8')) as PackMetadata
    } catch {
      // A directory without a readable metadata.json is not a story: skip it
      // silently rather than failing the whole listing.
      continue
    }
    const { bytes, fileCount } = await weigh(path)
    stories.push({
      directory,
      title: metadata.title ?? directory,
      uuid: metadata.uuid ?? '',
      version: metadata.version ?? 0,
      minAge: metadata.age ?? 0,
      category: metadata.category ?? '',
      description: metadata.description ?? '',
      bytes,
      fileCount
    })
  }

  stories.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  return { ok: true, value: stories }
}
