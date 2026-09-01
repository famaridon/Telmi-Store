import { causeOf, fail, ok, type Result } from '@domain/errors'
import type { GitHubPulls } from '@domain/ports'
import type { Proposal, ProposalComment, RawPull } from '@domain/proposals'
import type { Proposed, ProposeRequest } from '@domain/propose'
import { proposalBranch, proposalCommitMessage } from '@domain/rules/entry'
import { sortProposals, toProposal } from '@domain/rules/proposals'

/**
 * Opening a pull request without ever cloning anything.
 *
 * Six REST calls put two small files on a branch and open the proposal. Two
 * things are easy to get wrong here, and both are handled below:
 *
 *  - **A fork is asynchronous.** GitHub answers the creation immediately and
 *    finishes later; creating a blob straight away fails intermittently. So we
 *    wait until the fork actually answers.
 *  - **A fork goes stale.** Branching from the fork's own tip would build on a
 *    months-old base and manufacture conflicts. The branch is therefore cut from
 *    the tip of the STORE, which the fork can reach since both share their
 *    objects on GitHub.
 */

const TIMEOUT_MS = 30_000
/** A fork usually appears in a second or two; beyond this, something is wrong. */
const FORK_ATTEMPTS = 20

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
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  body?: unknown
  what: string
}

/** Rends null on 404: « not there yet » is an answer, not a failure. */
const call = async <T>({ api, token, method, path, body, what }: Call): Promise<Result<T | null>> => {
  let response: Response
  try {
    response = await fetch(`${api}${path}`, {
      method,
      headers: headers(token),
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
  try {
    return ok(text === '' ? null : (JSON.parse(text) as T))
  } catch {
    return fail({ code: 'github/refused', status: response.status, what, body: text.slice(0, 300) })
  }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface RepoBody {
  full_name?: string
  default_branch?: string
}
interface RefBody {
  object?: { sha?: string }
}
interface CommitBody {
  sha?: string
  tree?: { sha?: string }
}
interface ShaBody {
  sha?: string
}
interface PullBody {
  html_url?: string
  number?: number
  title?: string
  state?: string
  merged_at?: string | null
  updated_at?: string
  head?: { ref?: string }
  user?: { login?: string }
}

interface ReviewBody {
  state?: string
  body?: string
  submitted_at?: string
  user?: { login?: string }
}

interface CommentBody {
  body?: string
  created_at?: string
  user?: { login?: string }
}

/** GitHub shouts its review states; we speak of them plainly. */
const lastReviewOf = (reviews: ReviewBody[]): RawPull['lastReview'] => {
  // Only the states that carry a decision count; « pending » and « dismissed »
  // say nothing about what the moderator wants.
  const decisive = reviews.filter((review) =>
    ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(review.state ?? '')
  )
  const last = decisive[decisive.length - 1]
  switch (last?.state) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes-requested'
    case 'COMMENTED':
      return 'commented'
    default:
      return null
  }
}

/**
 * `api` and `forkWaitMs` are injectable so the six-call sequence — the risky part
 * of this adapter — can be exercised against a fake GitHub without waiting.
 */
const commentOf = (author: string | undefined, body: string | undefined, at: string | undefined): ProposalComment | null =>
  body === undefined || body.trim() === ''
    ? null
    : { author: author ?? 'inconnu', body: body.trim(), at: at ?? '' }

export const createGitHubPulls = (
  api = 'https://api.github.com',
  forkWaitMs = 1_500
): GitHubPulls => ({
  async propose(token: string, request: ProposeRequest): Promise<Result<Proposed>> {
    const me = await call<{ login?: string }>({ api, token, method: 'GET', path: '/user', what: 'compte' })
    if (!me.ok) return me
    const login = me.value?.login
    if (login === undefined) {
      return fail({ code: 'github/refused', status: 200, what: 'compte', body: 'reponse sans login' })
    }

    // 1. The store's own tip: the base we branch from.
    const store = await call<RepoBody>({
      api,
      token,
      method: 'GET',
      path: `/repos/${request.storeRepo}`,
      what: 'store'
    })
    if (!store.ok) return store
    if (store.value === null) return fail({ code: 'propose/store-unreachable', repo: request.storeRepo })
    const storeBranch = store.value.default_branch ?? 'main'

    const storeRef = await call<RefBody>({
      api,
      token,
      method: 'GET',
      path: `/repos/${request.storeRepo}/git/ref/heads/${storeBranch}`,
      what: 'pointe du store'
    })
    if (!storeRef.ok) return storeRef
    const baseSha = storeRef.value?.object?.sha
    if (baseSha === undefined) return fail({ code: 'propose/store-unreachable', repo: request.storeRepo })

    const baseCommit = await call<CommitBody>({
      api,
      token,
      method: 'GET',
      path: `/repos/${request.storeRepo}/git/commits/${baseSha}`,
      what: 'commit de base'
    })
    if (!baseCommit.ok) return baseCommit
    const baseTree = baseCommit.value?.tree?.sha
    if (baseTree === undefined) {
      return fail({ code: 'github/refused', status: 200, what: 'commit de base', body: 'reponse sans arbre' })
    }

    // 2. The fork, and the wait until it truly exists.
    const storeName = request.storeRepo.split('/')[1]!
    const fork = `${login}/${storeName}`

    const existing = await call<RepoBody>({ api, token, method: 'GET', path: `/repos/${fork}`, what: 'fork' })
    if (!existing.ok) return existing

    if (existing.value === null) {
      const created = await call<RepoBody>({
        api,
        token,
        method: 'POST',
        path: `/repos/${request.storeRepo}/forks`,
        what: 'creation du fork'
      })
      if (!created.ok) return created

      let ready = false
      for (let attempt = 0; attempt < FORK_ATTEMPTS && !ready; attempt++) {
        await wait(forkWaitMs)
        const check = await call<RepoBody>({ api, token, method: 'GET', path: `/repos/${fork}`, what: 'fork' })
        if (!check.ok) return check
        ready = check.value !== null
      }
      if (!ready) return fail({ code: 'propose/fork-too-slow', repo: fork })
    }

    // 3. The two files, as blobs on the fork.
    const blobs: { path: string; sha: string }[] = []
    for (const file of request.files) {
      const blob = await call<ShaBody>({
        api,
        token,
        method: 'POST',
        path: `/repos/${fork}/git/blobs`,
        what: `envoi de ${file.path}`,
        body: { content: Buffer.from(file.bytes).toString('base64'), encoding: 'base64' }
      })
      if (!blob.ok) return blob
      if (blob.value?.sha === undefined) {
        return fail({ code: 'github/refused', status: 201, what: `envoi de ${file.path}`, body: 'reponse sans sha' })
      }
      blobs.push({ path: file.path, sha: blob.value.sha })
    }

    // 4. A tree on top of the store's tip, then a commit whose parent is it.
    const tree = await call<ShaBody>({
      api,
      token,
      method: 'POST',
      path: `/repos/${fork}/git/trees`,
      what: 'arbre',
      body: {
        base_tree: baseTree,
        tree: blobs.map((blob) => ({ path: blob.path, mode: '100644', type: 'blob', sha: blob.sha }))
      }
    })
    if (!tree.ok) return tree
    if (tree.value?.sha === undefined) {
      return fail({ code: 'github/refused', status: 201, what: 'arbre', body: 'reponse sans sha' })
    }

    const commit = await call<ShaBody>({
      api,
      token,
      method: 'POST',
      path: `/repos/${fork}/git/commits`,
      what: 'commit',
      body: {
        message: proposalCommitMessage(request.entry),
        tree: tree.value.sha,
        parents: [baseSha]
      }
    })
    if (!commit.ok) return commit
    if (commit.value?.sha === undefined) {
      return fail({ code: 'github/refused', status: 201, what: 'commit', body: 'reponse sans sha' })
    }

    // 5. The branch: created, or moved if a previous attempt left one behind.
    const branch = proposalBranch(request.entry.slug)
    const branchRef = await call<RefBody>({
      api,
      token,
      method: 'GET',
      path: `/repos/${fork}/git/ref/heads/${branch}`,
      what: 'branche'
    })
    if (!branchRef.ok) return branchRef

    const moved =
      branchRef.value === null
        ? await call({
            api,
            token,
            method: 'POST',
            path: `/repos/${fork}/git/refs`,
            what: 'creation de la branche',
            body: { ref: `refs/heads/${branch}`, sha: commit.value.sha }
          })
        : await call({
            api,
            token,
            method: 'PATCH',
            path: `/repos/${fork}/git/refs/heads/${branch}`,
            what: 'mise a jour de la branche',
            // The branch is ours and carries only this proposal: moving it is
            // the intended way to correct one.
            body: { sha: commit.value.sha, force: true }
          })
    if (!moved.ok) return moved

    // 6. The proposal itself — or the one already open, which we just updated.
    const open = await call<PullBody[]>({
      api,
      token,
      method: 'GET',
      path: `/repos/${request.storeRepo}/pulls?state=open&head=${login}:${branch}`,
      what: 'propositions ouvertes'
    })
    if (!open.ok) return open
    const already = open.value?.[0]
    if (already?.html_url !== undefined && already.number !== undefined) {
      return ok({ url: already.html_url, number: already.number, branch, fork, updated: true })
    }

    const pull = await call<PullBody>({
      api,
      token,
      method: 'POST',
      path: `/repos/${request.storeRepo}/pulls`,
      what: 'ouverture de la proposition',
      body: {
        title: request.title,
        body: request.body,
        head: `${login}:${branch}`,
        base: storeBranch,
        maintainer_can_modify: true
      }
    })
    if (!pull.ok) return pull
    if (pull.value?.html_url === undefined || pull.value.number === undefined) {
      return fail({ code: 'github/refused', status: 201, what: 'ouverture de la proposition', body: 'reponse incomplete' })
    }

    return ok({ url: pull.value.html_url, number: pull.value.number, branch, fork, updated: false })
  }
,

  async mine(token: string, storeRepo: string): Promise<Result<Proposal[]>> {
    const me = await call<{ login?: string }>({ api, token, method: 'GET', path: '/user', what: 'compte' })
    if (!me.ok) return me
    const login = me.value?.login
    if (login === undefined) {
      return fail({ code: 'github/refused', status: 200, what: 'compte', body: 'reponse sans login' })
    }

    const pulls = await call<PullBody[]>({
      api,
      token,
      method: 'GET',
      // A community store holds a handful of proposals: listing and filtering
      // costs one call, where the search API would cost a rate limit.
      path: `/repos/${storeRepo}/pulls?state=all&per_page=100`,
      what: 'propositions'
    })
    if (!pulls.ok) return pulls
    if (pulls.value === null) return fail({ code: 'propose/store-unreachable', repo: storeRepo })

    const mine = pulls.value.filter((pull) => pull.user?.login === login)
    const proposals: Proposal[] = []

    for (const pull of mine) {
      if (pull.number === undefined || pull.html_url === undefined) continue

      const reviews = await call<ReviewBody[]>({
        api,
        token,
        method: 'GET',
        path: `/repos/${storeRepo}/pulls/${pull.number}/reviews`,
        what: 'relectures'
      })
      if (!reviews.ok) return reviews

      const comments = await call<CommentBody[]>({
        api,
        token,
        method: 'GET',
        path: `/repos/${storeRepo}/issues/${pull.number}/comments`,
        what: 'commentaires'
      })
      if (!comments.ok) return comments

      // A refusal may arrive as a review, as a plain comment, or as both: the
      // contributor needs to read whichever it was.
      const said: ProposalComment[] = []
      for (const review of reviews.value ?? []) {
        const said1 = commentOf(review.user?.login, review.body, review.submitted_at)
        if (said1 !== null) said.push(said1)
      }
      for (const comment of comments.value ?? []) {
        const said2 = commentOf(comment.user?.login, comment.body, comment.created_at)
        if (said2 !== null) said.push(said2)
      }

      const raw: RawPull = {
        number: pull.number,
        url: pull.html_url,
        title: pull.title ?? '',
        branch: pull.head?.ref ?? '',
        author: login,
        closed: pull.state === 'closed',
        merged: pull.merged_at !== null && pull.merged_at !== undefined,
        at: pull.updated_at ?? '',
        lastReview: lastReviewOf(reviews.value ?? []),
        comments: said
      }
      proposals.push(toProposal(raw, storeRepo))
    }

    return ok(sortProposals(proposals))
  }
})
