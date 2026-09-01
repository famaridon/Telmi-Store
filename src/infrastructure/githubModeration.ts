import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { Awaiting } from '@domain/moderation'
import type { ProposalComment } from '@domain/proposals'
import type { GitHubModeration } from '@domain/ports'
import { entryFromJson } from '@domain/rules/moderation'

/**
 * Answering proposals.
 *
 * Two orderings matter here, and both are deliberate:
 *
 *  - a refusal **says why first, then closes**, so the reason is never lost if
 *    the second call fails;
 *  - an acceptance comments first as well, so the contributor reads something
 *    other than a bare merge notification.
 */

const TIMEOUT_MS = 30_000

const headers = (token: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'TelmiStore',
  'Content-Type': 'application/json'
})

interface Call {
  api: string
  token: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  path: string
  body?: unknown
  what: string
  /** Raw text rather than JSON: used to read a file from a branch. */
  raw?: boolean
}

const call = async <T>({ api, token, method, path, body, what, raw }: Call): Promise<Result<T | null>> => {
  let response: Response
  try {
    response = await fetch(`${api}${path}`, {
      method,
      headers: raw === true ? { ...headers(token), Accept: 'application/vnd.github.raw' } : headers(token),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  } catch (e) {
    return fail({ code: 'github/unreachable', cause: causeOf(e) })
  }
  if (response.status === 404) return ok(null)
  const text = await response.text()
  if (!response.ok) {
    return fail({ code: 'github/refused', status: response.status, what, body: text.slice(0, 300) })
  }
  if (raw === true) return ok(text as unknown as T)
  try {
    return ok(text === '' ? null : (JSON.parse(text) as T))
  } catch {
    return fail({ code: 'github/refused', status: response.status, what, body: text.slice(0, 300) })
  }
}

interface RepoBody {
  permissions?: { push?: boolean; maintain?: boolean; admin?: boolean }
}
interface PullBody {
  number?: number
  html_url?: string
  title?: string
  updated_at?: string
  user?: { login?: string }
  head?: { ref?: string; sha?: string; repo?: { full_name?: string } }
}
interface FileBody {
  filename?: string
}
interface CommentBody {
  body?: string
  created_at?: string
  user?: { login?: string }
}

export const createGitHubModeration = (api = 'https://api.github.com'): GitHubModeration => ({
  async mayModerate(token: string, storeRepo: string): Promise<Result<boolean>> {
    const repo = await call<RepoBody>({ api, token, method: 'GET', path: `/repos/${storeRepo}`, what: 'store' })
    if (!repo.ok) return repo
    if (repo.value === null) return fail({ code: 'propose/store-unreachable', repo: storeRepo })
    const permissions = repo.value.permissions
    return ok(permissions?.push === true || permissions?.maintain === true || permissions?.admin === true)
  },

  async awaiting(token: string, storeRepo: string): Promise<Result<Awaiting[]>> {
    const pulls = await call<PullBody[]>({
      api,
      token,
      method: 'GET',
      path: `/repos/${storeRepo}/pulls?state=open&per_page=100`,
      what: 'propositions ouvertes'
    })
    if (!pulls.ok) return pulls
    if (pulls.value === null) return fail({ code: 'propose/store-unreachable', repo: storeRepo })

    const waiting: Awaiting[] = []

    for (const pull of pulls.value) {
      if (pull.number === undefined || pull.html_url === undefined) continue

      const files = await call<FileBody[]>({
        api,
        token,
        method: 'GET',
        path: `/repos/${storeRepo}/pulls/${pull.number}/files?per_page=100`,
        what: 'fichiers de la proposition'
      })
      if (!files.ok) return files
      const changed = (files.value ?? []).map((file) => file.filename ?? '').filter((name) => name !== '')

      // The entry is read from the proposal's own branch, not from the store:
      // what is being judged is what the contributor wrote.
      const entryPath = changed.find((name) => name.startsWith('histoires/') && name.endsWith('.json'))
      let entry = entryFromJson(null)
      if (entryPath !== undefined && pull.head?.repo?.full_name !== undefined && pull.head.sha !== undefined) {
        const raw = await call<string>({
          api,
          token,
          method: 'GET',
          path: `/repos/${pull.head.repo.full_name}/contents/${entryPath}?ref=${pull.head.sha}`,
          what: 'fiche de la proposition',
          raw: true
        })
        if (!raw.ok) return raw
        if (raw.value !== null) {
          try {
            entry = entryFromJson(JSON.parse(raw.value))
          } catch {
            // A malformed entry is shown as empty and refused, not hidden.
          }
        }
      }

      const comments = await call<CommentBody[]>({
        api,
        token,
        method: 'GET',
        path: `/repos/${storeRepo}/issues/${pull.number}/comments`,
        what: 'commentaires'
      })
      if (!comments.ok) return comments

      const said: ProposalComment[] = (comments.value ?? [])
        .filter((comment) => (comment.body ?? '').trim() !== '')
        .map((comment) => ({
          author: comment.user?.login ?? 'inconnu',
          body: (comment.body ?? '').trim(),
          at: comment.created_at ?? ''
        }))

      waiting.push({
        number: pull.number,
        url: pull.html_url,
        title: pull.title ?? '',
        author: pull.user?.login ?? 'inconnu',
        at: pull.updated_at ?? '',
        entry,
        changed,
        comments: said
      })
    }

    // Oldest first: whoever has waited longest deserves an answer first.
    waiting.sort((a, b) => a.at.localeCompare(b.at))
    return ok(waiting)
  },

  async accept(token: string, storeRepo: string, number: number, comment: string): Promise<Result<void>> {
    if (comment.trim() !== '') {
      const said = await call({
        api,
        token,
        method: 'POST',
        path: `/repos/${storeRepo}/issues/${number}/comments`,
        what: 'message',
        body: { body: comment }
      })
      if (!said.ok) return said
    }
    const merged = await call({
      api,
      token,
      method: 'PUT',
      path: `/repos/${storeRepo}/pulls/${number}/merge`,
      what: 'fusion',
      body: { merge_method: 'squash' }
    })
    if (!merged.ok) return merged
    return ok(undefined)
  },

  async decline(token: string, storeRepo: string, number: number, comment: string): Promise<Result<void>> {
    // The reason first: if closing fails, the contributor still knows why.
    const said = await call({
      api,
      token,
      method: 'POST',
      path: `/repos/${storeRepo}/issues/${number}/comments`,
      what: 'message',
      body: { body: comment }
    })
    if (!said.ok) return said

    const closed = await call({
      api,
      token,
      method: 'PATCH',
      path: `/repos/${storeRepo}/pulls/${number}`,
      what: 'fermeture',
      body: { state: 'closed' }
    })
    if (!closed.ok) return closed
    return ok(undefined)
  }
})
