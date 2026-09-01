import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { causeOf, fail, type Result } from '@domain/errors'
import type { FileKind, PickedFile } from '@domain/model'
import type { Fetcher, FileVault, ProgressReport } from '@domain/ports'
import { acceptsMimeType, nameForDownload } from '@domain/rules/files'

/** Beyond this, a message beats a spinner that never stops. */
const TIMEOUT_MS = 60_000

/** At most one progress report per interval: the interface must not be flooded. */
const REPORT_EVERY_MS = 120

export const createHttpFetcher = (vault: FileVault): Fetcher => ({
  async fetchInto(url: string, kind: FileKind, onProgress: ProgressReport): Promise<Result<PickedFile>> {
    let address: URL
    try {
      address = new URL(url)
    } catch {
      return fail({ code: 'url/invalid', url })
    }
    if (address.protocol !== 'https:' && address.protocol !== 'http:') {
      return fail({ code: 'url/bad-protocol', protocol: address.protocol })
    }

    let response: Response
    try {
      response = await fetch(address, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
    } catch (e) {
      return fail({ code: 'url/unreachable', cause: causeOf(e) })
    }

    if (!response.ok || response.body === null) {
      return fail({ code: 'url/status', status: response.status, statusText: response.statusText, url })
    }

    const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!acceptsMimeType(mimeType, kind)) {
      return fail({ code: 'url/wrong-type', type: mimeType, kind })
    }

    const reserved = await vault.reserve(nameForDownload(url, mimeType, kind))
    if (!reserved.ok) return reserved
    const target = reserved.value

    const total = Number(response.headers.get('content-length')) || null
    let received = 0
    let lastReport = 0

    const stream = Readable.fromWeb(response.body as never)
    stream.on('data', (chunk: Buffer) => {
      received += chunk.length
      const now = Date.now()
      if (now - lastReport < REPORT_EVERY_MS) return
      lastReport = now
      onProgress(received, total)
    })

    try {
      await pipeline(stream, createWriteStream(target))
    } catch (e) {
      await rm(dirname(target), { recursive: true, force: true })
      return fail({ code: 'url/interrupted', cause: causeOf(e) })
    }

    onProgress(received, total ?? received)
    return vault.admit(target, kind, url)
  }
})
