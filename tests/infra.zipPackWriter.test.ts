import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yauzl from 'yauzl'
import { ok, type Result } from '@domain/errors'
import type { PickedFile, Submission } from '@domain/model'
import { MARKERS } from '@domain/pack'
import type { FileVault } from '@domain/ports'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import { planPack } from '@domain/rules/pack'
import { createZipPackWriter } from '@infra/zipPackWriter'

/** Reads an archive back: names, and the bytes of one entry. */
const readZip = (path: string): Promise<Map<string, Buffer>> =>
  new Promise((resolve, reject) => {
    const entries = new Map<string, Buffer>()
    yauzl.open(path, { lazyEntries: true }, (error, zip) => {
      if (error !== null || zip === undefined) return reject(error ?? new Error('zip illisible'))
      zip.readEntry()
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError !== null || stream === undefined) return reject(streamError)
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => {
            entries.set(entry.fileName, Buffer.concat(chunks))
            zip.readEntry()
          })
        })
      })
      zip.on('end', () => resolve(entries))
      zip.on('error', reject)
    })
  })

const FIXTURES = join(import.meta.dirname, 'fixtures')
const PIXEL = readFileSync(join(FIXTURES, 'pixel.png'))

let workDir: string

/** Resolves ids to the real fixture files, and reserves paths in a temp dir. */
const vault = (paths: Record<string, string>): FileVault => ({
  admit: async (): Promise<Result<PickedFile>> => ok({ id: 'x', name: 'x', bytes: 0, from: 'disk' }),
  resolve: (id: string) => paths[id] ?? null,
  reserve: async (name: string) => ok(join(workDir, `${Date.now()}-${name}`)),
  clear: async () => {}
})

const file = (id: string, name: string): PickedFile => ({ id, name, bytes: 1, from: 'disk' })

const submission = (): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Les contes de la mère Pauline',
  category: 'Contes',
  description: 'Deux contes.',
  question: 'Quelle histoire veux-tu écouter ?',
  minAge: 7,
  cover: file('cover', 'cover.png'),
  chapters: [
    { key: 'a', title: 'Ava et la couronne', audio: file('a1', 'piste-1.mp3'), duration: 1.2, image: null },
    { key: 'b', title: 'Gouzabas', audio: file('a2', 'piste-2.mp3'), duration: 1.2, image: null }
  ],
  rights: { status: 'own-work', source: 'moi', declaredBy: '@moi' }
})

const PATHS = {
  cover: join(FIXTURES, 'pixel.png'),
  a1: join(FIXTURES, 'piste-1.mp3'),
  a2: join(FIXTURES, 'piste-2.mp3')
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'telmi-pack-'))
})
afterAll(async () => {
  await rm(workDir, { recursive: true, force: true })
})

const buildOne = async (): Promise<{ entries: Map<string, Buffer>; sha256: string; bytes: number; fileCount: number }> => {
  const plan = planPack(submission(), { uuid: 'fffffc-test', version: 2 })
  const images = plan.images.map((image) => ({ path: image.path, bytes: new Uint8Array(PIXEL) }))
  const written = await createZipPackWriter(vault(PATHS)).write(plan, images)
  expect(written.ok).toBe(true)
  if (!written.ok) throw new Error('build failed')
  return { entries: await readZip(written.value.path), ...written.value }
}

describe('zipPackWriter — the archive Telmi-Sync will read', () => {
  it('contains the four markers ConvertZip demands, at the root', async () => {
    const { entries } = await buildOne()
    for (const marker of MARKERS) expect([...entries.keys()]).toContain(marker)
  })

  it('contains exactly what the plan named, and nothing else', async () => {
    const { entries, fileCount } = await buildOne()
    expect([...entries.keys()].sort()).toEqual([
      'audios/s0.mp3',
      'audios/s1.mp3',
      'cover.png',
      'images/m0.png',
      'images/m1.png',
      'metadata.json',
      'nodes.json',
      'notes.json',
      'title.mp3',
      'title.png'
    ])
    expect(fileCount).toBe(10)
  })

  it('copies the chapter audio byte for byte, without re-encoding it', async () => {
    const { entries } = await buildOne()
    expect(entries.get('audios/s0.mp3')).toEqual(readFileSync(PATHS.a1))
    expect(entries.get('audios/s1.mp3')).toEqual(readFileSync(PATHS.a2))
  })

  it('writes a metadata.json Telmi-Sync can read, version included', async () => {
    const { entries } = await buildOne()
    expect(JSON.parse(entries.get('metadata.json')!.toString('utf8'))).toEqual({
      title: 'Les contes de la mère Pauline',
      uuid: 'fffffc-test',
      image: 'cover.png',
      version: 2,
      category: 'Contes',
      description: 'Deux contes.',
      age: 7
    })
  })

  it('writes a nodes.json whose menu wraps back to the first chapter', async () => {
    const { entries } = await buildOne()
    const nodes = JSON.parse(entries.get('nodes.json')!.toString('utf8'))
    expect(nodes.startAction).toEqual({ action: 'q', index: 0 })
    expect(nodes.stages.s1.ok).toEqual({ action: 'm', index: 0 })
  })

  it('puts a real, playable mp3 in title.mp3 rather than an empty file', async () => {
    const { entries } = await buildOne()
    const title = entries.get('title.mp3')!
    expect(title.length).toBeGreaterThan(500)
    // A frame synchronisation, possibly after an ID3 header: it is genuine mp3.
    const head = title.subarray(0, 64)
    const hasSync = head.includes('ID3') || head.some((byte, i) => byte === 0xff && (head[i + 1]! & 0xe0) === 0xe0)
    expect(hasSync).toBe(true)
  })

  it('reports a sha256 that matches the file on disk', async () => {
    const plan = planPack(submission(), { uuid: 'fffffc-test', version: 1 })
    const images = plan.images.map((image) => ({ path: image.path, bytes: new Uint8Array(PIXEL) }))
    const written = await createZipPackWriter(vault(PATHS)).write(plan, images)
    expect(written.ok).toBe(true)
    if (!written.ok) return
    const onDisk = createHash('sha256').update(readFileSync(written.value.path)).digest('hex')
    expect(written.value.sha256).toBe(onDisk)
    expect(written.value.bytes).toBe(readFileSync(written.value.path).length)
  })

  it('names the archive after the story, without accents', async () => {
    const plan = planPack(submission(), { uuid: 'fffffc-test', version: 1 })
    expect(plan.archiveName).toBe('les-contes-de-la-mere-pauline')
  })
})

describe('zipPackWriter — voices, or silence in their place', () => {
  const withVoices = async (spokenTitles: boolean, voices: Record<string, Buffer>) => {
    const plan = planPack(submission(), { uuid: 'fffffc-test', version: 1, spokenTitles })
    const files = [
      ...plan.images.map((image) => ({ path: image.path, bytes: new Uint8Array(PIXEL) })),
      ...Object.entries(voices).map(([path, bytes]) => ({ path, bytes: new Uint8Array(bytes) }))
    ]
    const written = await createZipPackWriter(vault(PATHS)).write(plan, files)
    expect(written.ok).toBe(true)
    if (!written.ok) throw new Error('build failed')
    return readZip(written.value.path)
  }

  it('uses the recorded label when there is one', async () => {
    const voice = Buffer.alloc(4096, 42)
    const entries = await withVoices(true, { 'title.mp3': voice, 'audios/q.mp3': voice, 'audios/m0.mp3': voice, 'audios/m1.mp3': voice })
    expect(entries.get('title.mp3')).toEqual(voice)
    expect(entries.get('audios/m1.mp3')).toEqual(voice)
  })

  it('puts silence where a label was not recorded, rather than omitting the file', async () => {
    const voice = Buffer.alloc(4096, 42)
    const entries = await withVoices(true, { 'title.mp3': voice })
    // The file exists — the storyteller expects it — but it says nothing.
    expect(entries.get('title.mp3')).toEqual(voice)
    expect(entries.has('audios/m0.mp3')).toBe(true)
    expect(entries.get('audios/m0.mp3')).not.toEqual(voice)
    expect(entries.get('audios/m0.mp3')!.length).toBeGreaterThan(500)
  })

  it('writes no menu label at all when the titles are not spoken', async () => {
    const entries = await withVoices(false, {})
    expect(entries.has('audios/m0.mp3')).toBe(false)
    expect(entries.has('audios/q.mp3')).toBe(false)
    expect(entries.has('title.mp3')).toBe(true)
  })
})

describe('zipPackWriter — refusing rather than producing a broken pack', () => {
  it('names the image that was not drawn', async () => {
    const plan = planPack(submission(), { uuid: 'fffffc-test', version: 1 })
    const incomplete = plan.images
      .filter((image) => image.path !== 'title.png')
      .map((image) => ({ path: image.path, bytes: new Uint8Array(PIXEL) }))
    const written = await createZipPackWriter(vault(PATHS)).write(plan, incomplete)
    expect(written.ok).toBe(false)
    if (!written.ok && written.error.code === 'pack/missing-image') {
      expect(written.error.path).toBe('title.png')
    }
  })

  it('names the audio whose source has vanished', async () => {
    const plan = planPack(submission(), { uuid: 'fffffc-test', version: 1 })
    const images = plan.images.map((image) => ({ path: image.path, bytes: new Uint8Array(PIXEL) }))
    const written = await createZipPackWriter(vault({ cover: PATHS.cover, a1: PATHS.a1 })).write(plan, images)
    expect(written.ok).toBe(false)
    if (!written.ok && written.error.code === 'pack/unknown-source') {
      expect(written.error.path).toBe('audios/s1.mp3')
    }
  })
})
