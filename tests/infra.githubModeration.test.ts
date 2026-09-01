import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createGitHubModeration } from '@infra/githubModeration'

/**
 * Answering proposals, against a fake GitHub.
 *
 * Two orderings are the whole point of these tests: a refusal must say why
 * BEFORE closing, and an acceptance must comment before merging. If the second
 * call fails, the contributor must still have been told something.
 */
const STORE = 'famaridon/telmi-store-dev'

const FICHE = {
  slug: 'le-loup',
  titre: 'Le Loup',
  age: 3,
  categorie: 'Contes',
  langue: 'fr',
  description: 'Un conte.',
  uuid: 'fffffc-abc123',
  version: 1,
  droits: { statut: 'domaine-public', source: 'https://exemple.fr', declare_par: '@contributeur' },
  pack: {
    type: 'pack-release',
    depot: 'contributeur/le-loup',
    tag: 'le-loup-1.0.0',
    fichier: 'le-loup.zip',
    sha256: 'a'.repeat(64),
    taille: 4242
  }
}

interface Fake {
  server: Server
  base: string
  trail: { method: string; path: string; body: unknown }[]
  permissions: Record<string, boolean>
  pulls: unknown[]
  files: unknown[]
  ficheServed: string | null
  /** Makes the closing call fail, to check the reason was said first. */
  closeFails: boolean
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

    const send = (status: number, body: unknown, text = false): void => {
      response.writeHead(status, { 'Content-Type': text ? 'text/plain' : 'application/json' })
      response.end(text ? String(body) : JSON.stringify(body))
    }

    if (path === `/repos/${STORE}` && method === 'GET') return send(200, { permissions: fake.permissions })
    if (path === `/repos/${STORE}/pulls?state=open&per_page=100`) return send(200, fake.pulls)
    if (path.match(/\/pulls\/\d+\/files/)) return send(200, fake.files)
    if (path.includes('/contents/')) {
      return fake.ficheServed === null ? send(404, {}) : send(200, fake.ficheServed, true)
    }
    if (path.match(/\/issues\/\d+\/comments$/) && method === 'GET') return send(200, [])
    if (path.match(/\/issues\/\d+\/comments$/) && method === 'POST') return send(201, {})
    if (path.match(/\/pulls\/\d+\/merge$/) && method === 'PUT') return send(200, { merged: true })
    if (path.match(/\/pulls\/\d+$/) && method === 'PATCH') {
      return fake.closeFails ? send(500, { message: 'boum' }) : send(200, {})
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
    permissions: { push: true },
    pulls: [
      {
        number: 5,
        html_url: 'https://github.com/pr/5',
        title: 'Le Loup (3+)',
        updated_at: '2026-09-01T10:00:00Z',
        user: { login: 'contributeur' },
        head: { ref: 'proposition/le-loup', sha: 'headsha', repo: { full_name: 'contributeur/telmi-store-dev' } }
      }
    ],
    files: [{ filename: 'histoires/le-loup.json' }, { filename: 'vignettes/le-loup.png' }],
    ficheServed: JSON.stringify(FICHE),
    closeFails: false
  }
})

afterEach(async () => {
  await new Promise<void>((resolve) => fake.server.close(() => resolve()))
})

const moderation = () => createGitHubModeration(fake.base)

describe('mayModerate', () => {
  it('lets someone with push access answer', async () => {
    expect(await moderation().mayModerate('t', STORE)).toEqual({ ok: true, value: true })
  })

  it('refuses someone who can only read', async () => {
    fake.permissions = { push: false }
    expect(await moderation().mayModerate('t', STORE)).toEqual({ ok: true, value: false })
  })

  it('accepts maintain or admin as well', async () => {
    fake.permissions = { maintain: true }
    expect(await moderation().mayModerate('t', STORE)).toEqual({ ok: true, value: true })
    fake.permissions = { admin: true }
    expect(await moderation().mayModerate('t', STORE)).toEqual({ ok: true, value: true })
  })

  it('says the store is unreachable rather than rending false', async () => {
    const answer = await moderation().mayModerate('t', 'personne/nulle-part')
    expect(answer.ok).toBe(false)
    if (!answer.ok) expect(answer.error.code).toBe('propose/store-unreachable')
  })
})

describe('awaiting — what a moderator sees', () => {
  it('reads the entry from the proposal’s own branch, not from the store', async () => {
    const answer = await moderation().awaiting('t', STORE)
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    const proposal = answer.value[0]!
    expect(proposal.entry.title).toBe('Le Loup')
    expect(proposal.entry.rights.status).toBe('public-domain')
    expect(proposal.entry.pack.sha256).toBe('a'.repeat(64))
    // The file was read at the head commit of the contributor's fork.
    expect(fake.trail.some((c) => c.path.includes('/contents/histoires/le-loup.json?ref=headsha'))).toBe(true)
  })

  it('lists the files touched, so anything unexpected can be seen', async () => {
    fake.files = [{ filename: 'histoires/le-loup.json' }, { filename: '.github/workflows/valider.yml' }]
    const answer = await moderation().awaiting('t', STORE)
    if (!answer.ok) return
    expect(answer.value[0]?.changed).toContain('.github/workflows/valider.yml')
  })

  it('shows a proposal whose entry is unreadable instead of hiding it', async () => {
    fake.ficheServed = 'ceci n’est pas du JSON'
    const answer = await moderation().awaiting('t', STORE)
    expect(answer.ok).toBe(true)
    if (!answer.ok) return
    // Empty, therefore visibly wrong — and refusable.
    expect(answer.value[0]?.entry.title).toBe('')
  })

  it('shows the oldest first: whoever waited longest is answered first', async () => {
    fake.pulls = [
      { ...(fake.pulls[0] as object), number: 5, updated_at: '2026-09-05T00:00:00Z' },
      { ...(fake.pulls[0] as object), number: 2, updated_at: '2026-08-20T00:00:00Z' }
    ]
    const answer = await moderation().awaiting('t', STORE)
    if (!answer.ok) return
    expect(answer.value.map((p) => p.number)).toEqual([2, 5])
  })
})

describe('decline — the reason is said before the closing', () => {
  it('comments first, then closes', async () => {
    await moderation().decline('t', STORE, 5, 'Les droits ne sont pas clairs.')
    const order = fake.trail.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)
    expect(order[0]).toBe(`POST /repos/${STORE}/issues/5/comments`)
    expect(order[1]).toBe(`PATCH /repos/${STORE}/pulls/5`)
  })

  it('leaves the reason behind even when the closing fails', async () => {
    fake.closeFails = true
    const answer = await moderation().decline('t', STORE, 5, 'Trop bruité.')
    expect(answer.ok).toBe(false)
    // The contributor has been told, which is what matters most.
    const said = fake.trail.find((c) => c.method === 'POST' && c.path.endsWith('/comments'))
    expect((said?.body as { body: string }).body).toBe('Trop bruité.')
  })
})

describe('accept — never a bare merge', () => {
  it('comments before merging', async () => {
    await moderation().accept('t', STORE, 5, 'Écouté et accepté, merci !')
    const order = fake.trail.filter((c) => c.method !== 'GET').map((c) => c.method)
    expect(order).toEqual(['POST', 'PUT'])
  })

  it('merges without a message when there is nothing to say', async () => {
    await moderation().accept('t', STORE, 5, '   ')
    expect(fake.trail.filter((c) => c.method === 'POST')).toHaveLength(0)
    expect(fake.trail.filter((c) => c.method === 'PUT')).toHaveLength(1)
  })
})
