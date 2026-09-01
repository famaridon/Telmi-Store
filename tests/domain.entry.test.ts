import { describe, expect, it } from 'vitest'
import type { PackLocation, Submission } from '@domain/model'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import {
  buildEntry,
  entryFileName,
  entrySlug,
  entryToJson,
  releaseFileName,
  releaseTag,
  thumbnailFileName
} from '@domain/rules/entry'

const submission = (over: Partial<Submission> = {}): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Les contes de la mère Pauline',
  minAge: 7,
  category: 'Contes',
  language: 'fr',
  description: 'Cinq contes.',
  rights: { status: 'public-domain', source: '  https://litteratureaudio.com  ', declaredBy: 'ignored by design' },
  ...over
})

const pack: PackLocation = {
  kind: 'release',
  repo: 'famaridon/les-contes-de-la-mere-pauline',
  tag: 'les-contes-de-la-mere-pauline-1.0.0',
  file: 'les-contes-de-la-mere-pauline.zip',
  sha256: 'a'.repeat(64),
  bytes: 24_318_442
}

const identity = { uuid: 'fffffc-abc123', version: 1, declaredBy: '@famaridon' }

describe('file names, as the store checker demands them', () => {
  it('derives the slug from the title, without accents or punctuation', () => {
    expect(entrySlug('Les contes de la mère Pauline')).toBe('les-contes-de-la-mere-pauline')
  })

  it('names the entry and its thumbnail after the slug', () => {
    const entry = buildEntry(submission(), identity, pack)
    expect(entryFileName(entry)).toBe('histoires/les-contes-de-la-mere-pauline.json')
    expect(thumbnailFileName(entry)).toBe('vignettes/les-contes-de-la-mere-pauline.png')
  })

  it('tags the release with a version, never « latest »', () => {
    expect(releaseTag('le-loup', 1)).toBe('le-loup-1.0.0')
    expect(releaseTag('le-loup', 3)).toBe('le-loup-3.0.0')
    expect(releaseTag('le-loup', 1)).not.toBe('latest')
  })

  it('names the archive after the slug', () => {
    expect(releaseFileName('le-loup')).toBe('le-loup.zip')
  })
})

describe('buildEntry', () => {
  it('takes the signed-in login as declarant, not what the form says', () => {
    const entry = buildEntry(submission(), identity, pack)
    expect(entry.rights.declaredBy).toBe('@famaridon')
  })

  it('trims the whitespace around the source', () => {
    expect(buildEntry(submission(), identity, pack).rights.source).toBe('https://litteratureaudio.com')
  })

  it('carries the uuid and version it was given', () => {
    const entry = buildEntry(submission(), { ...identity, version: 4 }, pack)
    expect(entry.uuid).toBe('fffffc-abc123')
    expect(entry.version).toBe(4)
  })
})

describe('entryToJson — the crossing into French, in the one place that knows both', () => {
  const json = (over: Partial<Submission> = {}): Record<string, unknown> =>
    entryToJson(buildEntry(submission(over), identity, pack))

  it('writes exactly the keys the store checker expects', () => {
    expect(Object.keys(json()).sort()).toEqual([
      'age',
      'categorie',
      'description',
      'droits',
      'langue',
      'pack',
      'slug',
      'titre',
      'uuid',
      'version'
    ])
  })

  it('translates each of the five rights statuses', () => {
    const statut = (status: Submission['rights']['status']): unknown =>
      (json({ rights: { status, source: 'x', declaredBy: 'y' } })['droits'] as Record<string, unknown>)['statut']
    expect(statut('own-work')).toBe('cree-par-le-contributeur')
    expect(statut('public-domain')).toBe('domaine-public')
    expect(statut('cc-by')).toBe('cc-by')
    expect(statut('cc-by-sa')).toBe('cc-by-sa')
    expect(statut('written-permission')).toBe('autorisation-ecrite')
  })

  it('describes a release pack with repo, tag, file, checksum and size', () => {
    expect(json()['pack']).toEqual({
      type: 'pack-release',
      depot: 'famaridon/les-contes-de-la-mere-pauline',
      tag: 'les-contes-de-la-mere-pauline-1.0.0',
      fichier: 'les-contes-de-la-mere-pauline.zip',
      sha256: 'a'.repeat(64),
      taille: 24_318_442
    })
  })

  it('describes a pack hosted elsewhere', () => {
    const entry = buildEntry(submission(), identity, {
      kind: 'external',
      url: 'https://archive.org/download/x/x.zip',
      sha256: 'b'.repeat(64),
      bytes: 42
    })
    expect(entryToJson(entry)['pack']).toEqual({
      type: 'pack-externe',
      url: 'https://archive.org/download/x/x.zip',
      sha256: 'b'.repeat(64),
      taille: 42
    })
  })

  it('describes a pack served by a repository archive, branch included', () => {
    const entry = buildEntry(submission(), identity, {
      kind: 'repo-archive',
      repo: 'https://github.com/moi/mon-pack',
      branch: 'main',
      sha256: 'c'.repeat(64),
      bytes: 7
    })
    expect(entryToJson(entry)['pack']).toEqual({
      type: 'pack-depot',
      depot: 'https://github.com/moi/mon-pack',
      branche: 'main',
      sha256: 'c'.repeat(64),
      taille: 7
    })
  })

  it('satisfies every rule of the store checker', () => {
    const fiche = json()
    const droits = fiche['droits'] as Record<string, unknown>
    const contenuPack = fiche['pack'] as Record<string, unknown>

    // The same checks as outils/verifier-fiches.mjs, one by one.
    for (const clef of ['slug', 'titre', 'age', 'categorie', 'langue', 'description', 'uuid', 'version', 'droits', 'pack']) {
      expect(fiche[clef], clef).toBeDefined()
    }
    expect(fiche['slug']).toMatch(/^[a-z0-9-]+$/)
    expect(typeof fiche['age']).toBe('number')
    expect(fiche['age'] as number).toBeGreaterThanOrEqual(0)
    expect(fiche['age'] as number).toBeLessThanOrEqual(18)
    expect(fiche['version'] as number).toBeGreaterThanOrEqual(1)
    expect(String(fiche['uuid'])).toMatch(/^[a-z0-9-]{6,}$/i)
    expect(['cree-par-le-contributeur', 'domaine-public', 'cc-by', 'cc-by-sa', 'autorisation-ecrite'])
      .toContain(droits['statut'])
    expect(droits['source']).toBeTruthy()
    expect(droits['declare_par']).toBeTruthy()
    expect(contenuPack['type']).toBe('pack-release')
    expect(String(contenuPack['depot'])).toMatch(/^[\w.-]+\/[\w.-]+$/)
    expect(contenuPack['tag']).not.toBe('latest')
    expect(String(contenuPack['sha256'])).toMatch(/^[0-9a-f]{64}$/)
    expect(contenuPack['taille'] as number).toBeGreaterThanOrEqual(1)
  })
})
