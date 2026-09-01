import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { request } from 'node:https'
import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { GitHubRepos, ProgressReport, PublishedAsset } from '@domain/ports'

/**
 * Publishing a pack in a repository the contributor owns.
 *
 * Every step first asks whether the thing already exists. That is not
 * politeness: an upload of two hundred mega-octets fails often enough that
 * resuming has to be the normal case, and a second attempt must not leave a
 * trail of duplicate repositories and releases behind it.
 */

const API = 'https://api.github.com'
const UPLOADS = 'https://uploads.github.com'
const TIMEOUT_MS = 30_000

const headers = (token: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'TelmiStore'
})

interface Call {
  token: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  /** Named in the error, so a failure says which step went wrong. */
  what: string
}

const call = async <T>({ token, method, path, body, what }: Call): Promise<Result<T | null>> => {
  let response: Response
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (e) {
    return fail({ code: 'github/unreachable', cause: causeOf(e) })
  }

  // A 404 is an answer, not a failure: it means « not there yet ».
  if (response.status === 404) return ok(null)
  if (response.status === 204) return ok(null)

  const text = await response.text()
  if (!response.ok) {
    return fail({ code: 'github/refused', status: response.status, what, body: text.slice(0, 300) })
  }
  try {
    return ok(text === '' ? null : (JSON.parse(text) as T))
  } catch {
    return fail({ code: 'github/refused', status: response.status, what, body: text.slice(0, 300) })
  }
}

interface RepoBody {
  full_name?: string
}
interface ReleaseBody {
  id?: number
  assets?: { id: number; name: string }[]
}
interface AssetBody {
  browser_download_url?: string
  size?: number
}

export const createGitHubRepos = (): GitHubRepos => ({
  async ensureRepo(token: string, name: string, description: string): Promise<Result<string>> {
    const me = await call<{ login?: string }>({ token, method: 'GET', path: '/user', what: 'compte' })
    if (!me.ok) return me
    const login = me.value?.login
    if (login === undefined) {
      return fail({ code: 'github/refused', status: 200, what: 'compte', body: 'reponse sans login' })
    }

    const existing = await call<RepoBody>({
      token,
      method: 'GET',
      path: `/repos/${login}/${name}`,
      what: 'depot'
    })
    if (!existing.ok) return existing
    if (existing.value !== null && existing.value.full_name !== undefined) {
      return ok(existing.value.full_name)
    }

    const created = await call<RepoBody>({
      token,
      method: 'POST',
      path: '/user/repos',
      what: 'creation du depot',
      body: { name, description, private: false, has_issues: true, has_wiki: false }
    })
    if (!created.ok) return created
    if (created.value?.full_name === undefined) {
      return fail({ code: 'github/refused', status: 201, what: 'creation du depot', body: 'reponse sans full_name' })
    }
    return ok(created.value.full_name)
  },

  async ensureRelease(token: string, repo: string, tag: string, body: string): Promise<Result<number>> {
    const existing = await call<ReleaseBody>({
      token,
      method: 'GET',
      path: `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
      what: 'release'
    })
    if (!existing.ok) return existing
    if (existing.value?.id !== undefined) return ok(existing.value.id)

    const created = await call<ReleaseBody>({
      token,
      method: 'POST',
      path: `/repos/${repo}/releases`,
      what: 'creation de la release',
      body: { tag_name: tag, name: tag, body, draft: false, prerelease: false }
    })
    if (!created.ok) return created
    if (created.value?.id === undefined) {
      return fail({ code: 'github/refused', status: 201, what: 'creation de la release', body: 'reponse sans id' })
    }
    return ok(created.value.id)
  },

  async putAsset(
    token: string,
    repo: string,
    releaseId: number,
    fileName: string,
    path: string,
    onProgress: ProgressReport
  ): Promise<Result<PublishedAsset>> {
    // Replace rather than refuse: a resumed upload finds its own leftovers.
    const release = await call<ReleaseBody>({
      token,
      method: 'GET',
      path: `/repos/${repo}/releases/${releaseId}`,
      what: 'release'
    })
    if (!release.ok) return release
    const stale = release.value?.assets?.find((asset) => asset.name === fileName)
    if (stale !== undefined) {
      const removed = await call({
        token,
        method: 'DELETE',
        path: `/repos/${repo}/releases/assets/${stale.id}`,
        what: 'suppression de l ancien fichier'
      })
      if (!removed.ok) return removed
    }

    let total: number
    try {
      total = (await stat(path)).size
    } catch (e) {
      return fail({ code: 'github/upload-failed', cause: causeOf(e) })
    }

    // `fetch` gives no upload progress, and this upload can last minutes.
    return new Promise<Result<PublishedAsset>>((resolve) => {
      const url = new URL(`${UPLOADS}/repos/${repo}/releases/${releaseId}/assets`)
      url.searchParams.set('name', fileName)

      const upload = request(
        url,
        {
          method: 'POST',
          headers: { ...headers(token), 'Content-Type': 'application/zip', 'Content-Length': String(total) }
        },
        (response) => {
          const chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => chunks.push(chunk))
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8')
            const status = response.statusCode ?? 0
            if (status < 200 || status >= 300) {
              return resolve(
                fail({ code: 'github/refused', status, what: 'envoi du fichier', body: text.slice(0, 300) })
              )
            }
            let asset: AssetBody
            try {
              asset = JSON.parse(text) as AssetBody
            } catch {
              return resolve(fail({ code: 'github/upload-failed', cause: 'reponse illisible' }))
            }
            if (asset.browser_download_url === undefined) {
              return resolve(fail({ code: 'github/upload-failed', cause: 'reponse sans url' }))
            }
            resolve(ok({ url: asset.browser_download_url, bytes: asset.size ?? total }))
          })
        }
      )

      upload.on('error', (e) => resolve(fail({ code: 'github/upload-failed', cause: causeOf(e) })))
      upload.setTimeout(0)

      let sent = 0
      let lastReport = 0
      const file = createReadStream(path)
      file.on('data', (chunk: Buffer) => {
        sent += chunk.length
        const now = Date.now()
        if (now - lastReport < 200) return
        lastReport = now
        onProgress(sent, total)
      })
      file.on('error', (e) => {
        upload.destroy()
        resolve(fail({ code: 'github/upload-failed', cause: causeOf(e) }))
      })
      file.on('end', () => onProgress(total, total))
      file.pipe(upload)
    })
  },

  async checkPublic(url: string, expectedBytes: number): Promise<Result<void>> {
    // A release URL answers 302 towards a signed one: follow it, as the
    // storyteller's own downloader does.
    let response: Response
    try {
      response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (e) {
      return fail({ code: 'github/unreachable', cause: causeOf(e) })
    }
    if (!response.ok) return fail({ code: 'github/not-public', url, status: response.status })

    const found = Number(response.headers.get('content-length')) || 0
    if (found !== 0 && found !== expectedBytes) {
      return fail({ code: 'github/size-mismatch', expected: expectedBytes, found })
    }
    return ok(undefined)
  }
})
