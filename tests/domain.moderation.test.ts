import { describe, expect, it } from 'vitest'
import type { PackLocation, Submission } from '@domain/model'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import { buildEntry, entryToJson } from '@domain/rules/entry'
import { planPack } from '@domain/rules/pack'
import { entryFromJson, packUrlOf, playlistFromNodes, questionFromNotes } from '@domain/rules/moderation'

const submission = (over: Partial<Submission> = {}): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Les contes de la mère Pauline',
  minAge: 7,
  category: 'Contes',
  language: 'fr',
  description: 'Cinq contes.',
  question: 'Quelle histoire veux-tu écouter ?',
  cover: { id: 'cover', name: 'c.jpg', bytes: 1, from: 'disk' },
  chapters: ['Ava et la couronne', 'Gouzabas', 'La petite fille et le dragon'].map((title) => ({
    key: `k-${title}`,
    title,
    audio: { id: `a-${title}`, name: `${title}.mp3`, bytes: 1, from: 'disk' },
    duration: 60,
    image: null
  })),
  rights: { status: 'public-domain', source: 'https://litteratureaudio.com', declaredBy: '' },
  ...over
})

const pack: PackLocation = {
  kind: 'release',
  repo: 'contributeur/les-contes',
  tag: 'les-contes-1.0.0',
  file: 'les-contes.zip',
  sha256: 'e'.repeat(64),
  bytes: 4242
}

describe('entryFromJson — the two sides agree', () => {
  it('reads back exactly what the contributor’s side wrote', () => {
    const entry = buildEntry(submission(), { uuid: 'fffffc-abc', version: 2, declaredBy: '@moi' }, pack)
    expect(entryFromJson(entryToJson(entry))).toEqual(entry)
  })

  it('survives the round trip for each rights status', () => {
    for (const status of ['own-work', 'public-domain', 'cc-by', 'cc-by-sa', 'written-permission'] as const) {
      const entry = buildEntry(
        submission({ rights: { status, source: 'x', declaredBy: '' } }),
        { uuid: 'fffffc-abc', version: 1, declaredBy: '@moi' },
        pack
      )
      expect(entryFromJson(entryToJson(entry)).rights.status).toBe(status)
    }
  })

  it('survives the round trip for each kind of pack location', () => {
    const locations: PackLocation[] = [
      pack,
      { kind: 'external', url: 'https://archive.org/x.zip', sha256: 'f'.repeat(64), bytes: 7 },
      { kind: 'repo-archive', repo: 'https://github.com/moi/p', branch: 'main', sha256: '0'.repeat(64), bytes: 9 }
    ]
    for (const location of locations) {
      const entry = buildEntry(submission(), { uuid: 'fffffc-abc', version: 1, declaredBy: '@moi' }, location)
      expect(entryFromJson(entryToJson(entry)).pack).toEqual(location)
    }
  })

  it('shows a malformed entry rather than crashing on it', () => {
    // A moderator must be able to see and refuse rubbish, not meet a blank screen.
    const entry = entryFromJson({ titre: 42, droits: 'non', pack: null })
    expect(entry.title).toBe('')
    expect(entry.rights.status).toBe('own-work')
    expect(entry.pack.kind).toBe('release')
  })

  it('copes with nothing at all', () => {
    expect(entryFromJson(undefined).slug).toBe('')
    expect(entryFromJson(null).version).toBe(0)
  })
})

describe('packUrlOf', () => {
  it('builds the public address of a release asset', () => {
    expect(packUrlOf(pack)).toBe(
      'https://github.com/contributeur/les-contes/releases/download/les-contes-1.0.0/les-contes.zip'
    )
  })

  it('uses the address as given for a pack hosted elsewhere', () => {
    expect(packUrlOf({ kind: 'external', url: 'https://archive.org/x.zip', sha256: '', bytes: 0 })).toBe(
      'https://archive.org/x.zip'
    )
  })

  it('asks GitHub to zip a repository, on the right branch', () => {
    expect(packUrlOf({ kind: 'repo-archive', repo: 'https://github.com/moi/p', sha256: '', bytes: 0 })).toBe(
      'https://github.com/moi/p/archive/refs/heads/main.zip'
    )
    expect(
      packUrlOf({ kind: 'repo-archive', repo: 'https://github.com/moi/p', branch: 'master', sha256: '', bytes: 0 })
    ).toBe('https://github.com/moi/p/archive/refs/heads/master.zip')
  })
})

describe('playlistFromNodes — the order a child actually hears', () => {
  const built = (spoken = false) =>
    planPack(submission(), { uuid: 'fffffc-abc', version: 1, spokenTitles: spoken })

  it('reads the menu order out of the pack we built', () => {
    const plan = built()
    expect(playlistFromNodes(plan.nodes, plan.notes)).toEqual([
      { title: 'Ava et la couronne', audio: 's0.mp3' },
      { title: 'Gouzabas', audio: 's1.mp3' },
      { title: 'La petite fille et le dragon', audio: 's2.mp3' }
    ])
  })

  it('follows the menu, not the file names', () => {
    const plan = built()
    // Reverse the menu: the playlist must follow it rather than s0, s1, s2.
    const shuffled = {
      ...plan.nodes,
      actions: { ...plan.nodes.actions, m: [...(plan.nodes.actions['m'] ?? [])].reverse() }
    }
    expect(playlistFromNodes(shuffled, plan.notes).map((c) => c.audio)).toEqual([
      's2.mp3',
      's1.mp3',
      's0.mp3'
    ])
  })

  it('works the same whether the labels are spoken or not', () => {
    expect(playlistFromNodes(built(true).nodes, built(true).notes)).toEqual(
      playlistFromNodes(built(false).nodes, built(false).notes)
    )
  })

  it('skips a menu entry whose wiring is broken instead of failing', () => {
    const plan = built()
    const broken = {
      ...plan.nodes,
      stages: { ...plan.nodes.stages, m1: { ...plan.nodes.stages['m1']!, ok: null } }
    }
    expect(playlistFromNodes(broken, plan.notes).map((c) => c.audio)).toEqual(['s0.mp3', 's2.mp3'])
  })

  it('rends nothing for a pack with no menu', () => {
    expect(playlistFromNodes({ startAction: { action: 'q', index: 0 }, stages: {}, actions: {} }, {})).toEqual([])
  })
})

describe('questionFromNotes', () => {
  it('reads the question the storyteller asks first', () => {
    const plan = planPack(submission(), { uuid: 'fffffc-abc', version: 1 })
    expect(questionFromNotes(plan.notes)).toBe('Quelle histoire veux-tu écouter ?')
  })

  it('rends an empty string when the pack has none', () => {
    expect(questionFromNotes({})).toBe('')
  })
})
