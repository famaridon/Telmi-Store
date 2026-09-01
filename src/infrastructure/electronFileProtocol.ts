import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { protocol } from 'electron'
import { Readable } from 'node:stream'
import type { FileVault } from '@domain/ports'
import { extensionOf } from '@domain/rules/files'
import { FILE_SCHEME } from '@shared/contract'

/**
 * `telmi-file://` — lets the interface DISPLAY a cover and PLAY a chapter
 * without granting it access to the disk.
 *
 * The renderer only ever knows an opaque id, resolved here through the vault.
 *
 * The content security policy allows this scheme in `img-src` and `media-src`
 * but not in `connect-src`, so the interface can render a file without being
 * able to read its bytes in JavaScript. Verified at runtime. Keep it that way.
 */

/** Must run before app.whenReady(): the scheme has to exist before any load. */
export const registerFileScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
    }
  ])
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif'
}

/** Call after app.whenReady(). */
export const serveFileScheme = (vault: FileVault): void => {
  protocol.handle(FILE_SCHEME, async (request) => {
    const id = new URL(request.url).pathname.replace(/^\//, '')
    const path = vault.resolve(id)
    if (path === null) return new Response('unknown id', { status: 404 })

    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      return new Response('gone', { status: 404 })
    }

    const headers: Record<string, string> = {
      'Content-Type': MIME_BY_EXTENSION[extensionOf(path)] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes'
    }

    // An <audio> element asks for ranges so the listener can seek in the track.
    const asked = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/)
    if (asked) {
      const start = asked[1] ? Number(asked[1]) : 0
      const end = asked[2] ? Math.min(Number(asked[2]), size - 1) : size - 1
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      }
      const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
      return new Response(body, {
        status: 206,
        headers: {
          ...headers,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1)
        }
      })
    }

    const body = Readable.toWeb(createReadStream(path)) as ReadableStream
    return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
  })
}
