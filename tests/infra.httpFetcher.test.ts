import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ok, type Result } from '@domain/errors'
import type { FileKind, PickedFile } from '@domain/model'
import type { FileVault } from '@domain/ports'
import { createHttpFetcher } from '@infra/httpFetcher'

/**
 * The fetcher is tested against an in-memory vault. That is what the ports buy:
 * the adapter under test is the HTTP one, and nothing else has to be real.
 */
const BODY = Buffer.alloc(64 * 1024, 7)

let server: Server
let base: string
let workDir: string

/** Records what it is given, and hands out paths in a real temp directory. */
const fakeVault = (): FileVault & { admitted: PickedFile[] } => {
  const admitted: PickedFile[] = []
  let n = 0
  return {
    admitted,
    async admit(path: string, _kind: FileKind, url?: string): Promise<Result<PickedFile>> {
      const file: PickedFile = {
        id: `id-${++n}`,
        name: path.split('/').pop() ?? '',
        bytes: readFileSync(path).length,
        from: url ? 'url' : 'disk',
        ...(url ? { url } : {})
      }
      admitted.push(file)
      return ok(file)
    },
    resolve: () => null,
    reserve: async (name: string) => ok(join(workDir, `${++n}-${name}`)),
    clear: async () => {}
  }
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'telmi-fetcher-'))
  server = createServer((request, response) => {
    switch (request.url ?? '/') {
      case '/track.mp3':
        response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(BODY.length) })
        return response.end(BODY)
      case '/no-length.mp3':
        response.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        return response.end(BODY)
      case '/no-type':
        response.writeHead(200)
        return response.end(BODY)
      case '/page.html':
        response.writeHead(200, { 'Content-Type': 'text/html' })
        return response.end('<html></html>')
      case '/private':
        response.writeHead(403)
        return response.end('no')
      case '/redirect':
        response.writeHead(302, { Location: '/track.mp3' })
        return response.end()
      default:
        response.writeHead(404)
        return response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(workDir, { recursive: true, force: true })
})

describe('httpFetcher — success', () => {
  it('writes the file and hands it to the vault, with its origin', async () => {
    const vault = fakeVault()
    const answer = await createHttpFetcher(vault).fetchInto(`${base}/track.mp3`, 'audio', () => {})
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.bytes).toBe(BODY.length)
    expect(answer.value.from).toBe('url')
    expect(answer.value.url).toBe(`${base}/track.mp3`)
    expect(vault.admitted).toHaveLength(1)
  })

  it('reports progress and ends on the real total', async () => {
    const seen: { received: number; total: number | null }[] = []
    const answer = await createHttpFetcher(fakeVault()).fetchInto(`${base}/track.mp3`, 'audio', (received, total) =>
      seen.push({ received, total })
    )
    expect(answer.ok).toBe(true)
    expect(seen.at(-1)).toEqual({ received: BODY.length, total: BODY.length })
  })

  it('copes when the server announces no size', async () => {
    const seen: (number | null)[] = []
    const answer = await createHttpFetcher(fakeVault()).fetchInto(`${base}/no-length.mp3`, 'audio', (_r, total) =>
      seen.push(total)
    )
    expect(answer.ok).toBe(true)
    expect(seen.at(-1)).toBe(BODY.length)
  })

  it('lets a response through when no content type is announced', async () => {
    const answer = await createHttpFetcher(fakeVault()).fetchInto(`${base}/no-type`, 'audio', () => {})
    expect(answer.ok).toBe(true)
  })

  it('follows a redirect', async () => {
    const answer = await createHttpFetcher(fakeVault()).fetchInto(`${base}/redirect`, 'audio', () => {})
    expect(answer.ok).toBe(true)
    if (answer.ok) expect(answer.value.bytes).toBe(BODY.length)
  })
})

describe('httpFetcher — failures, each named', () => {
  const codeOf = async (url: string, kind: FileKind = 'audio'): Promise<string> => {
    const answer = await createHttpFetcher(fakeVault()).fetchInto(url, kind, () => {})
    return answer.ok ? 'ok' : answer.error.code
  }

  it('rejects an invalid URL', async () => {
    expect(await codeOf('not a url')).toBe('url/invalid')
  })

  it('rejects any protocol other than http(s)', async () => {
    expect(await codeOf('file:///etc/passwd')).toBe('url/bad-protocol')
  })

  it('reports the HTTP status, keeping it as data', async () => {
    const answer = await createHttpFetcher(fakeVault()).fetchInto(`${base}/private`, 'audio', () => {})
    expect(answer.ok).toBe(false)
    if (!answer.ok && answer.error.code === 'url/status') expect(answer.error.status).toBe(403)
  })

  it('rejects a response that is not of the requested kind', async () => {
    expect(await codeOf(`${base}/page.html`)).toBe('url/wrong-type')
    expect(await codeOf(`${base}/track.mp3`, 'image')).toBe('url/wrong-type')
  })

  it('reports an unreachable address without waiting forever', async () => {
    expect(await codeOf('http://127.0.0.1:1/nothing.mp3')).toBe('url/unreachable')
  })

  it('gives up cleanly when the vault cannot reserve a path', async () => {
    const brokenVault: FileVault = {
      ...fakeVault(),
      reserve: async () => ({ ok: false, error: { code: 'workdir/unavailable', cause: 'disque plein' } })
    }
    const answer = await createHttpFetcher(brokenVault).fetchInto(`${base}/track.mp3`, 'audio', () => {})
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('workdir/unavailable')
  })
})
