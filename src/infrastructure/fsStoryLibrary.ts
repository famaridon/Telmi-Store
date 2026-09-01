import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { LocalStory } from '@domain/model'
import type { StoryLibrary } from '@domain/ports'

/**
 * Telmi-Sync's library, read from ~/.telmi/stories.
 *
 * Read-only, without exception: that directory belongs to Telmi-Sync.
 */

interface PackMetadata {
  title?: string
  uuid?: string
  version?: number
  age?: number
  category?: string
  description?: string
}

const weigh = async (path: string): Promise<{ bytes: number; fileCount: number }> => {
  let bytes = 0
  let fileCount = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) {
      const inner = await weigh(child)
      bytes += inner.bytes
      fileCount += inner.fileCount
    } else if (entry.isFile()) {
      bytes += (await stat(child)).size
      fileCount += 1
    }
  }
  return { bytes, fileCount }
}

export const createFsStoryLibrary = (root = join(homedir(), '.telmi', 'stories')): StoryLibrary => ({
  async list(): Promise<Result<LocalStory[]>> {
    let directories: string[]
    try {
      directories = (await readdir(root, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch (e) {
      return fail({ code: 'library/not-found', path: root, cause: causeOf(e) })
    }

    const stories: LocalStory[] = []
    for (const directory of directories) {
      const path = join(root, directory)
      let metadata: PackMetadata
      try {
        metadata = JSON.parse(await readFile(join(path, 'metadata.json'), 'utf8')) as PackMetadata
      } catch {
        // A directory without readable metadata is not a story: skip it rather
        // than failing the whole listing.
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
    return ok(stories)
  }
})
