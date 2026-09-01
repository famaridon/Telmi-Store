import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { PlayablePack } from '@domain/moderation'
import type { PackNodes, PackNotes } from '@domain/pack'
import type { FileVault, PackReader } from '@domain/ports'
import { playlistFromNodes, questionFromNotes } from '@domain/rules/moderation'

/**
 * Opening a pack so a moderator can hear it.
 *
 * Nothing is installed: the archive is unzipped into a temporary folder, and its
 * audio is granted to the interface through the vault. A moderator's own library
 * must not fill up with proposals they are about to refuse.
 *
 * The checksum is computed while downloading, and compared with the one the entry
 * declares — which is the only way to know that what is being listened to is what
 * was proposed.
 */
const extractAll = (archive: string, into: string): Promise<Map<string, string>> =>
  new Promise((resolve, reject) => {
    const written = new Map<string, string>()
    yauzl.open(archive, { lazyEntries: true }, (error, zip) => {
      if (error !== null || zip === undefined) return reject(error ?? new Error('archive illisible'))
      zip.readEntry()
      zip.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName.endsWith('/')) return zip.readEntry()
        // Only the two things a listener needs, and never a path that escapes.
        const safe = entry.fileName.replace(/\\/g, '/').replace(/(^|\/)\.\.(\/|$)/g, '/')
        const target = join(into, safe)
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError !== null || stream === undefined) return reject(streamError)
          void (async () => {
            try {
              await import('node:fs/promises').then((fs) => fs.mkdir(dirname(target), { recursive: true }))
              await pipeline(stream, createWriteStream(target))
              written.set(safe, target)
              zip.readEntry()
            } catch (e) {
              reject(e)
            }
          })()
        })
      })
      zip.on('end', () => resolve(written))
      zip.on('error', reject)
    })
  })

export const createZipPackReader = (vault: FileVault): PackReader => ({
  async open(url: string, expectedSha256: string): Promise<Result<PlayablePack>> {
    const reserved = await vault.reserve('proposition.zip')
    if (!reserved.ok) return reserved
    const archive = reserved.value
    const folder = join(dirname(archive), 'ouvert')

    let response: Response
    try {
      response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
    } catch (e) {
      return fail({ code: 'url/unreachable', cause: causeOf(e) })
    }
    if (!response.ok || response.body === null) {
      return fail({ code: 'url/status', status: response.status, statusText: response.statusText, url })
    }

    const digest = createHash('sha256')
    const stream = Readable.fromWeb(response.body as never)
    stream.on('data', (chunk: Buffer) => digest.update(chunk))
    try {
      await pipeline(stream, createWriteStream(archive))
    } catch (e) {
      return fail({ code: 'url/interrupted', cause: causeOf(e) })
    }

    const found = digest.digest('hex')
    // Said, not enforced: a moderator should be able to listen to a pack whose
    // checksum drifted, and refuse it knowingly.
    const checksumMatches = expectedSha256 === '' || found === expectedSha256

    let files: Map<string, string>
    try {
      await rm(folder, { recursive: true, force: true })
      files = await extractAll(archive, folder)
    } catch (e) {
      return fail({ code: 'pack/unreadable-archive', cause: causeOf(e) })
    }

    // The pack files may sit at the root or inside one directory: find them.
    const nodesPath = [...files.keys()].find((name) => name.endsWith('nodes.json'))
    const notesPath = [...files.keys()].find((name) => name.endsWith('notes.json'))
    const metadataPath = [...files.keys()].find((name) => name.endsWith('metadata.json'))
    if (nodesPath === undefined || metadataPath === undefined) {
      return fail({ code: 'pack/unreadable-archive', cause: 'nodes.json ou metadata.json absent' })
    }
    const root = nodesPath.slice(0, nodesPath.length - 'nodes.json'.length)

    let nodes: PackNodes
    let notes: PackNotes
    let title: string
    try {
      nodes = JSON.parse(await readFile(files.get(nodesPath)!, 'utf8')) as PackNodes
      notes = notesPath === undefined ? {} : (JSON.parse(await readFile(files.get(notesPath)!, 'utf8')) as PackNotes)
      const metadata = JSON.parse(await readFile(files.get(metadataPath)!, 'utf8')) as { title?: string }
      title = metadata.title ?? ''
    } catch (e) {
      return fail({ code: 'pack/unreadable-archive', cause: causeOf(e) })
    }

    const playlist = playlistFromNodes(nodes, notes)
    if (playlist.length === 0) return fail({ code: 'pack/no-chapter' })

    const chapters: PlayablePack['chapters'] = []
    for (const chapter of playlist) {
      const path = files.get(`${root}audios/${chapter.audio}`)
      if (path === undefined) continue
      const admitted = await vault.admit(path, 'audio')
      if (!admitted.ok) return admitted
      chapters.push({ title: chapter.title, audioId: admitted.value.id })
    }
    if (chapters.length === 0) return fail({ code: 'pack/no-chapter' })

    return ok({ title, question: questionFromNotes(notes), chapters, checksumMatches })
  }
})
