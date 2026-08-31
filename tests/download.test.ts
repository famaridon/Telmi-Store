import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { clearWorkDir, download } from '../src/main/download'
import { allowedPath } from '../src/main/files'

/** A real mp3 is unnecessary: nothing here decodes audio. */
const BODY = Buffer.alloc(64 * 1024, 7)

let server: Server
let base: string

beforeAll(async () => {
  server = createServer((request, response) => {
    switch (request.url ?? '/') {
      case '/track.mp3':
        response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(BODY.length) })
        return response.end(BODY)
      case '/no-length.mp3':
        response.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        return response.end(BODY)
      case '/page.html':
        response.writeHead(200, { 'Content-Type': 'text/html' })
        return response.end('<html></html>')
      case '/private':
        response.writeHead(403, { 'Content-Type': 'text/plain' })
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
  await clearWorkDir()
})

describe('download — success', () => {
  it('fetches the file, allows it for display and describes it', async () => {
    const r = await download(`${base}/track.mp3`, 'audio')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name).toBe('track.mp3')
    expect(r.value.bytes).toBe(BODY.length)
    expect(r.value.from).toBe('url')
    // The id must open the telmi-file protocol, and the contents must match.
    const path = allowedPath(r.value.id)
    expect(path).not.toBeNull()
    expect(readFileSync(path!).length).toBe(BODY.length)
  })

  it('reports progress and ends on the real total', async () => {
    const seen: { received: number; total: number | null }[] = []
    const r = await download(`${base}/track.mp3`, 'audio', (received, total) => seen.push({ received, total }))
    expect(r.ok).toBe(true)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toEqual({ received: BODY.length, total: BODY.length })
  })

  it('copes when the server does not announce the size', async () => {
    const seen: (number | null)[] = []
    const r = await download(`${base}/no-length.mp3`, 'audio', (_received, total) => seen.push(total))
    expect(r.ok).toBe(true)
    expect(seen.at(-1)).toBe(BODY.length)
  })

  it('follows a redirect', async () => {
    const r = await download(`${base}/redirect`, 'audio')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.bytes).toBe(BODY.length)
  })
})

describe('download — failures, each with its own message', () => {
  it('rejects an invalid URL', async () => {
    const r = await download('not a url', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('url/invalid')
  })

  it('rejects any protocol other than http(s)', async () => {
    const r = await download('file:///etc/passwd', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('url/protocol')
  })

  it('reports the HTTP status', async () => {
    const r = await download(`${base}/private`, 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('url/status')
      expect(r.error.message).toContain('403')
    }
  })

  it('rejects an address returning something other than an mp3', async () => {
    const r = await download(`${base}/page.html`, 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('url/wrong-type')
      expect(r.error.message).toContain('text/html')
    }
  })

  it('reports an unreachable address without waiting forever', async () => {
    const r = await download('http://127.0.0.1:1/nothing.mp3', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('url/unreachable')
  })

  it('refuses audio on the image channel', async () => {
    expect((await download(`${base}/track.mp3`, 'image')).ok).toBe(false)
  })
})
