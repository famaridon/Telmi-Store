import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { protocol } from 'electron'
import { Readable } from 'node:stream'
import { FILE_SCHEME } from '@shared/ipc'
import { allowedPath } from './files'

/**
 * `telmi-file://` protocol: lets the interface DISPLAY a cover and PLAY a
 * chapter without granting it access to the disk.
 *
 * The renderer only ever knows an opaque id. Only files the contributor
 * explicitly picked are served: no path and no directory traversal is reachable
 * from the interface.
 *
 * The content security policy allows this scheme in `img-src` and `media-src`
 * but not in `connect-src`, so the interface can render a file without being
 * able to read its bytes in JavaScript. Keep it that way.
 */
export const registerProtocolScheme = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
    }
  ])
}

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
}

/** `telmi-file://local/<id>` */
export const fileUrl = (id: string): string => `${FILE_SCHEME}://local/${id}`

/** Call after app.whenReady(). */
export const serveProtocol = (): void => {
  protocol.handle(FILE_SCHEME, async (request) => {
    const id = new URL(request.url).pathname.replace(/^\//, '')
    const path = allowedPath(id)
    if (path === null) return new Response('unknown id', { status: 404 })

    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      return new Response('gone', { status: 404 })
    }

    const type = MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
    const headers: Record<string, string> = { 'Content-Type': type, 'Accept-Ranges': 'bytes' }

    // An <audio> element asks for ranges so the listener can seek in the track.
    const range = request.headers.get('Range')
    const m = range?.match(/^bytes=(\d*)-(\d*)$/)
    if (m) {
      const start = m[1] ? Number(m[1]) : 0
      const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      }
      const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
      return new Response(body, {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
      })
    }

    const body = Readable.toWeb(createReadStream(path)) as ReadableStream
    return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
  })
}
