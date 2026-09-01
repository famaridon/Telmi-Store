import { describe, expect, it } from 'vitest'
import type { PackLocation, Submission } from '@domain/model'
import { EMPTY_SUBMISSION } from '@domain/rules/submission'
import { buildEntry, proposalBranch, proposalCommitMessage } from '@domain/rules/entry'
import { proposalBody, proposalTitle } from '../src/renderer/src/propose/proseDeLaProposition'

const submission = (over: Partial<Submission> = {}): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Les contes de la mère Pauline',
  minAge: 7,
  category: 'Contes',
  language: 'fr',
  description: 'Cinq contes écrits et lus par Pauline Pucciano.',
  rights: { status: 'public-domain', source: 'https://litteratureaudio.com', declaredBy: '' },
  ...over
})

const pack: PackLocation = {
  kind: 'release',
  repo: 'contributeur/les-contes-de-la-mere-pauline',
  tag: 'les-contes-de-la-mere-pauline-1.0.0',
  file: 'les-contes-de-la-mere-pauline.zip',
  sha256: 'd'.repeat(64),
  bytes: 24_318_442
}

const entry = (over: Partial<Submission> = {}) =>
  buildEntry(submission(over), { uuid: 'fffffc-abc', version: 1, declaredBy: '@contributeur' }, pack)

const URL = 'https://github.com/contributeur/x/releases/download/t/x.zip'

describe('the branch and the commit', () => {
  it('gives each story its own branch, so several proposals can be in flight', () => {
    expect(proposalBranch('le-loup')).toBe('proposition/le-loup')
    expect(proposalBranch('la-chevre')).toBe('proposition/la-chevre')
  })

  it('writes a commit message that names the story and its version', () => {
    expect(proposalCommitMessage(entry())).toBe('add les-contes-de-la-mere-pauline 1')
  })
})

describe('proposalTitle', () => {
  it('names the story and the age it is for', () => {
    expect(proposalTitle(entry())).toBe('Les contes de la mère Pauline (7+)')
  })
})

describe('proposalBody — what a moderator needs to decide', () => {
  const body = (over: Partial<Submission> = {}): string => proposalBody(entry(over), URL)

  it('carries every fact a decision rests on', () => {
    const text = body()
    expect(text).toContain('Les contes de la mère Pauline')
    expect(text).toContain('Cinq contes écrits et lus par Pauline Pucciano.')
    expect(text).toContain('7+')
    expect(text).toContain('Contes')
    expect(text).toContain('Domaine public')
    expect(text).toContain('https://litteratureaudio.com')
    expect(text).toContain('@contributeur')
  })

  it('says where the pack lives, since the store will not hold it', () => {
    expect(body()).toContain(URL)
  })

  it('carries the checksum, so what was reviewed can be told apart later', () => {
    expect(body()).toContain('d'.repeat(64))
  })

  it('says so plainly when there is no description, rather than leaving a blank', () => {
    expect(body({ description: '   ' })).toContain('Aucune description fournie')
  })

  it('names each rights status in words, not in codes', () => {
    expect(body({ rights: { status: 'own-work', source: 'moi', declaredBy: '' } })).toContain(
      "J'en suis l'auteur"
    )
    expect(body({ rights: { status: 'cc-by-sa', source: 'x', declaredBy: '' } })).toContain(
      'Creative Commons BY-SA'
    )
  })

  it('stays a table rather than a paragraph: it is scanned, not read', () => {
    const lines = body().split('\n')
    expect(lines.filter((line) => line.startsWith('| '))).not.toHaveLength(0)
  })
})
