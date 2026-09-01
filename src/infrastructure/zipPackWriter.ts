import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { BuiltPack, PackPlan } from '@domain/pack'
import type { DrawnImage, FileVault, PackWriter } from '@domain/ports'
import { silentMp3 } from './silentMp3'

/**
 * Writes the archive the store will publish.
 *
 * Files sit at the ROOT of the zip, with no wrapping directory: both shapes were
 * validated against `ConvertZip.js`, and this one avoids having to reproduce
 * Telmi-Sync's directory-naming rules — the import regenerates that name from
 * the metadata anyway.
 *
 * The chapter audio is copied byte for byte, never re-encoded: it is the bulk of
 * the weight, and converting it is not our job — Telmi-Sync has a command for
 * that if a file ever needs it.
 */
export const createZipPackWriter = (vault: FileVault): PackWriter => ({
  async write(plan: PackPlan, images: DrawnImage[]): Promise<Result<BuiltPack>> {
    const drawn = new Map(images.map((image) => [image.path, image.bytes]))

    // Refuse early and by name: a missing marker would otherwise become an
    // archive silently rejected at import.
    for (const image of plan.images) {
      if (!drawn.has(image.path)) return fail({ code: 'pack/missing-image', path: image.path })
    }

    const sources = new Map<string, string>()
    for (const audio of plan.audios) {
      const path = vault.resolve(audio.sourceId)
      if (path === null) return fail({ code: 'pack/unknown-source', path: audio.path })
      sources.set(audio.path, path)
    }

    const reserved = await vault.reserve(`${plan.archiveName}.zip`)
    if (!reserved.ok) return reserved
    const target = reserved.value

    const zip = new ZipFile()
    let fileCount = 0

    const addBuffer = (path: string, data: Buffer): void => {
      zip.addBuffer(data, path)
      fileCount += 1
    }

    addBuffer('metadata.json', Buffer.from(JSON.stringify(plan.metadata, null, 1), 'utf8'))
    addBuffer('nodes.json', Buffer.from(JSON.stringify(plan.nodes, null, 1), 'utf8'))
    addBuffer('notes.json', Buffer.from(JSON.stringify(plan.notes, null, 1), 'utf8'))

    for (const image of plan.images) addBuffer(image.path, Buffer.from(drawn.get(image.path)!))
    // Silence for now; a recorded or synthesised voice replaces it later.
    for (const spoken of plan.spoken) addBuffer(spoken.path, silentMp3())

    for (const [path, source] of sources) {
      zip.addFile(source, path)
      fileCount += 1
    }

    zip.end()

    const digest = createHash('sha256')
    try {
      // Hash while writing rather than reading the archive twice.
      zip.outputStream.on('data', (chunk: Buffer) => digest.update(chunk))
      await pipeline(zip.outputStream, createWriteStream(target))
    } catch (e) {
      return fail({ code: 'pack/unwritable', cause: causeOf(e) })
    }

    let bytes: number
    try {
      bytes = (await stat(target)).size
    } catch (e) {
      return fail({ code: 'pack/unwritable', cause: causeOf(e) })
    }

    return ok({ path: target, sha256: digest.digest('hex'), bytes, fileCount })
  }
})

/** Sha-256 of a file already on disk. Used to check a published pack. */
export const sha256OfFile = async (path: string): Promise<Result<string>> => {
  const digest = createHash('sha256')
  try {
    await pipeline(createReadStream(path), digest)
  } catch (e) {
    return fail({ code: 'file/unreadable', name: basename(path), cause: causeOf(e) })
  }
  return ok(digest.digest('hex'))
}
