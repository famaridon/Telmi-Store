import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { PackLocation, Submission } from '@domain/model'
import type { ProposeRequest } from '@domain/propose'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import { buildEntry } from '@domain/rules/entry'
import { createGitHubPulls } from '@infra/githubPulls'

/**
 * The six-call sequence, against a fake GitHub.
 *
 * This adapter cannot be tried against the real API without creating public
 * repositories on someone's account, and it is the part where the ordering
 * matters most: a fork answers late, a branch may already exist, a proposal may
 * already be open. So the fake records every call and the tests read that trail.
 */

const STORE = 'famaridon/telmi-store-dev'
const BASE_SHA = 'aaaa111'
const BASE_TREE = 'tttt222'

interface Fake {
  server: Server
  base: string
  trail: { method: string; path: string; body: unknown }[]
  /** Flipped to make the fork appear only after a few polls. */
  forkAppearsAfter: number
  forkPolls: number
  branchExists: boolean
  pullAlreadyOpen: boolean
  /** What GET /pulls?state=all rends, for the « mine » tests. */
  allPulls: unknown[]
  reviews: Record<number, unknown[]>
  comments: Record<number, unknown[]>
}

let fake: Fake

const handler = (request: IncomingMessage, response: ServerResponse): void => {
  const chunks: Buffer[] = []
  request.on('data', (chunk: Buffer) => chunks.push(chunk))
  request.on('end', () => {
    const path = request.url ?? ''
    const method = request.method ?? 'GET'
    const raw = Buffer.concat(chunks).toString('utf8')
    fake.trail.push({ method, path, body: raw === '' ? null : JSON.parse(raw) })

    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    if (path === '/user') return send(200, { login: 'contributeur' })
    if (path === `/repos/${STORE}` && method === 'GET') return send(200, { default_branch: 'main' })
    if (path === `/repos/${STORE}/git/ref/heads/main`) return send(200, { object: { sha: BASE_SHA } })
    if (path === `/repos/${STORE}/git/commits/${BASE_SHA}`) return send(200, { tree: { sha: BASE_TREE } })

    if (path === '/repos/contributeur/telmi-store-dev' && method === 'GET') {
      fake.forkPolls += 1
      return fake.forkPolls > fake.forkAppearsAfter
        ? send(200, { full_name: 'contributeur/telmi-store-dev' })
        : send(404, { message: 'Not Found' })
    }
    if (path === `/repos/${STORE}/forks` && method === 'POST') return send(202, {})

    if (path === '/repos/contributeur/telmi-store-dev/git/blobs') return send(201, { sha: `blob${fake.trail.length}` })
    if (path === '/repos/contributeur/telmi-store-dev/git/trees') return send(201, { sha: 'newtree' })
    if (path === '/repos/contributeur/telmi-store-dev/git/commits') return send(201, { sha: 'newcommit' })

    if (path.startsWith('/repos/contributeur/telmi-store-dev/git/ref/heads/proposition/')) {
      return fake.branchExists ? send(200, { object: { sha: 'oldcommit' } }) : send(404, { message: 'Not Found' })
    }
    if (path === '/repos/contributeur/telmi-store-dev/git/refs' && method === 'POST') return send(201, {})
    if (path.startsWith('/repos/contributeur/telmi-store-dev/git/refs/heads/') && method === 'PATCH') {
      return send(200, {})
    }

    if (path === `/repos/${STORE}/pulls?state=all&per_page=100`) return send(200, fake.allPulls)

    const relecture = path.match(/^\/repos\/.+\/pulls\/(\d+)\/reviews$/)
    if (relecture) return send(200, fake.reviews[Number(relecture[1])] ?? [])

    const commentaires = path.match(/^\/repos\/.+\/issues\/(\d+)\/comments$/)
    if (commentaires) return send(200, fake.comments[Number(commentaires[1])] ?? [])

    if (path.startsWith(`/repos/${STORE}/pulls?`)) {
      return send(200, fake.pullAlreadyOpen ? [{ html_url: 'https://github.com/pr/7', number: 7 }] : [])
    }
    if (path === `/repos/${STORE}/pulls` && method === 'POST') {
      return send(201, { html_url: 'https://github.com/pr/42', number: 42 })
    }

    send(404, { message: `imprevu : ${method} ${path}` })
  })
}

beforeEach(async () => {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  fake = {
    server,
    base: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
    trail: [],
    forkAppearsAfter: 0,
    forkPolls: 0,
    branchExists: false,
    pullAlreadyOpen: false,
    allPulls: [],
    reviews: {},
    comments: {}
  }
})

afterEach(async () => {
  await new Promise<void>((resolve) => fake.server.close(() => resolve()))
})

const submission: Submission = {
  ...EMPTY_SUBMISSION,
  title: 'Les contes de la mère Pauline',
  minAge: 7,
  category: 'Contes',
  description: 'Cinq contes.',
  rights: { status: 'public-domain', source: 'https://litteratureaudio.com', declaredBy: '' }
}

const pack: PackLocation = {
  kind: 'release',
  repo: 'contributeur/les-contes-de-la-mere-pauline',
  tag: 'les-contes-de-la-mere-pauline-1.0.0',
  file: 'les-contes-de-la-mere-pauline.zip',
  sha256: 'a'.repeat(64),
  bytes: 1234
}

const entry = buildEntry(submission, { uuid: 'fffffc-abc123', version: 1, declaredBy: '@contributeur' }, pack)

const request: ProposeRequest = {
  storeRepo: STORE,
  entry,
  files: [
    { path: 'histoires/les-contes-de-la-mere-pauline.json', bytes: new TextEncoder().encode('{}') },
    { path: 'vignettes/les-contes-de-la-mere-pauline.png', bytes: new Uint8Array([1, 2, 3]) }
  ],
  title: 'Les contes de la mère Pauline (7+)',
  body: 'corps de la proposition'
}

const propose = () => createGitHubPulls(fake.base, 1).propose('gho_x', request)

const pathsOf = (method: string): string[] =>
  fake.trail.filter((c) => c.method === method).map((c) => c.path)

describe('propose — the happy path', () => {
  it('opens the proposal and rends its number', async () => {
    const answer = await propose()
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.number).toBe(42)
    expect(answer.value.branch).toBe('proposition/les-contes-de-la-mere-pauline')
    expect(answer.value.fork).toBe('contributeur/telmi-store-dev')
    expect(answer.value.updated).toBe(false)
  })

  it('branches from the tip of the STORE, not of the fork', async () => {
    await propose()
    // The base tree and the parent commit both come from the store's own tip:
    // branching off a stale fork is what manufactures conflicts.
    const tree = fake.trail.find((c) => c.path.endsWith('/git/trees'))
    const commit = fake.trail.find((c) => c.path.endsWith('/git/commits') && c.method === 'POST')
    expect((tree?.body as { base_tree: string }).base_tree).toBe(BASE_TREE)
    expect((commit?.body as { parents: string[] }).parents).toEqual([BASE_SHA])
  })

  it('sends exactly the two files, base64 encoded', async () => {
    await propose()
    const blobs = fake.trail.filter((c) => c.path.endsWith('/git/blobs'))
    expect(blobs).toHaveLength(2)
    for (const blob of blobs) {
      expect((blob.body as { encoding: string }).encoding).toBe('base64')
    }
    const tree = fake.trail.find((c) => c.path.endsWith('/git/trees'))
    expect((tree?.body as { tree: { path: string }[] }).tree.map((t) => t.path)).toEqual([
      'histoires/les-contes-de-la-mere-pauline.json',
      'vignettes/les-contes-de-la-mere-pauline.png'
    ])
  })

  it('carries the wording the interface composed, untouched', async () => {
    await propose()
    const pull = fake.trail.find((c) => c.path === `/repos/${STORE}/pulls` && c.method === 'POST')
    expect(pull?.body).toMatchObject({
      title: 'Les contes de la mère Pauline (7+)',
      body: 'corps de la proposition',
      head: 'contributeur:proposition/les-contes-de-la-mere-pauline',
      base: 'main'
    })
  })
})

describe('propose — a fork that answers late', () => {
  it('waits for it instead of failing on the next call', async () => {
    fake.forkAppearsAfter = 3
    const answer = await propose()
    expect(answer.ok).toBe(true)
    expect(pathsOf('POST')).toContain(`/repos/${STORE}/forks`)
    // It polled until the fork existed rather than pressing on.
    expect(fake.forkPolls).toBeGreaterThan(3)
  })

  it('gives up with a name when it never appears', async () => {
    fake.forkAppearsAfter = 999
    const answer = await propose()
    expect(answer.ok).toBe(false)
    if (!answer.ok && answer.error.code === 'propose/fork-too-slow') {
      expect(answer.error.repo).toBe('contributeur/telmi-store-dev')
    }
  })

  it('does not fork again when one already exists', async () => {
    const answer = await propose()
    expect(answer.ok).toBe(true)
    expect(pathsOf('POST')).not.toContain(`/repos/${STORE}/forks`)
  })
})

describe('propose — correcting a proposal instead of duplicating it', () => {
  it('moves an existing branch rather than trying to create it', async () => {
    fake.branchExists = true
    const answer = await propose()
    expect(answer.ok).toBe(true)
    expect(pathsOf('PATCH')).toContain(
      '/repos/contributeur/telmi-store-dev/git/refs/heads/proposition/les-contes-de-la-mere-pauline'
    )
    expect(pathsOf('POST')).not.toContain('/repos/contributeur/telmi-store-dev/git/refs')
  })

  it('rends the proposal already open instead of opening a second one', async () => {
    fake.branchExists = true
    fake.pullAlreadyOpen = true
    const answer = await propose()
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.number).toBe(7)
    expect(answer.value.updated).toBe(true)
    expect(pathsOf('POST')).not.toContain(`/repos/${STORE}/pulls`)
  })
})

describe('propose — a store that is not there', () => {
  it('says so rather than failing further down', async () => {
    const answer = await createGitHubPulls(fake.base, 1).propose('gho_x', {
      ...request,
      storeRepo: 'personne/nulle-part'
    })
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('propose/store-unreachable')
  })
})

describe('mine — following one’s own proposals', () => {
  const brut = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    number: 3,
    html_url: 'https://github.com/pr/3',
    title: 'Le Loup (3+)',
    state: 'open',
    merged_at: null,
    updated_at: '2026-09-01T10:00:00Z',
    head: { ref: 'proposition/le-loup' },
    user: { login: 'contributeur' },
    ...over
  })

  const mine = () => createGitHubPulls(fake.base, 1).mine('gho_x', STORE)

  it('keeps only the contributor’s own proposals', async () => {
    fake.allPulls = [brut(), brut({ number: 9, user: { login: 'quelqu-un-d-autre' } })]
    const answer = await mine()
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    expect(answer.value.map((p) => p.number)).toEqual([3])
  })

  it('reads the story out of the branch', async () => {
    fake.allPulls = [brut()]
    const answer = await mine()
    if (!answer.ok) return
    expect(answer.value[0]?.slug).toBe('le-loup')
  })

  it('merges what was said in reviews and in plain comments', async () => {
    fake.allPulls = [brut()]
    fake.reviews[3] = [
      { state: 'CHANGES_REQUESTED', body: 'Les droits ne sont pas clairs.', submitted_at: '2026-09-02T09:00:00Z', user: { login: 'moderateur' } }
    ]
    fake.comments[3] = [
      { body: 'Merci pour la proposition !', created_at: '2026-09-01T11:00:00Z', user: { login: 'moderateur' } }
    ]
    const answer = await mine()
    if (!answer.ok) return
    const proposal = answer.value[0]!
    expect(proposal.state).toBe('changes-requested')
    // Oldest first, whichever kind it was.
    expect(proposal.comments.map((c) => c.body)).toEqual([
      'Merci pour la proposition !',
      'Les droits ne sont pas clairs.'
    ])
  })

  it('ignores an empty review body rather than showing a blank message', async () => {
    fake.allPulls = [brut()]
    fake.reviews[3] = [{ state: 'APPROVED', body: '', submitted_at: '2026-09-02T09:00:00Z', user: { login: 'm' } }]
    const answer = await mine()
    if (!answer.ok) return
    expect(answer.value[0]?.comments).toEqual([])
  })

  it('reads a merged proposal as accepted', async () => {
    fake.allPulls = [brut({ state: 'closed', merged_at: '2026-09-03T10:00:00Z' })]
    const answer = await mine()
    if (!answer.ok) return
    expect(answer.value[0]?.state).toBe('accepted')
  })

  it('reads a closed proposal that was never merged as refused', async () => {
    fake.allPulls = [brut({ state: 'closed', merged_at: null })]
    const answer = await mine()
    if (!answer.ok) return
    expect(answer.value[0]?.state).toBe('declined')
  })

  it('rends an empty list rather than a failure when nothing was proposed', async () => {
    fake.allPulls = []
    const answer = await mine()
    expect(answer).toEqual({ ok: true, value: [] })
  })

  it('says the store is unreachable rather than rending nothing', async () => {
    const answer = await createGitHubPulls(fake.base, 1).mine('gho_x', 'personne/nulle-part')
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('propose/store-unreachable')
  })
})
