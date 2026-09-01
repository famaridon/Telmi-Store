import { describe, expect, it } from 'vitest'
import type { Chapter, PickedFile, Submission } from '@domain/model'
import {
  BYTES_LIMIT,
  EMPTY_SUBMISSION,
  chaptersFromFiles,
  moveInList,
  reviewSubmission,
  titleFromFilename
} from '@domain/rules/submission'

const file = (name: string, bytes = 1024): PickedFile => ({
  id: `id-${name}`,
  name,
  bytes,
  from: 'disk'
})

const chapter = (title: string, bytes = 1024, duration: number | null = 10): Chapter => ({
  key: `k-${title}`,
  title,
  audio: file(`${title}.mp3`, bytes),
  duration,
  image: null
})

/** A submission with nothing left to fix, as a baseline for the tests below. */
const complete = (): Submission => ({
  ...EMPTY_SUBMISSION,
  title: 'Contes du soir',
  cover: file('cover.jpg'),
  chapters: [chapter('Le Loup'), chapter('La Chèvre')],
  description: 'Deux contes.',
  rights: { status: 'own-work', source: 'enregistré par moi', declaredBy: '@moi' }
})

describe('titleFromFilename', () => {
  it('drops the extension', () => {
    expect(titleFromFilename('Le Petit Chaperon rouge.mp3')).toBe('Le Petit Chaperon rouge')
  })

  it('drops a leading track number, whatever its punctuation', () => {
    expect(titleFromFilename('01 - Le Loup.mp3')).toBe('Le Loup')
    expect(titleFromFilename('02. Les Trois Cochons.mp3')).toBe('Les Trois Cochons')
    expect(titleFromFilename('3) Boucle d Or.mp3')).toBe('Boucle d Or')
    expect(titleFromFilename('04_Cendrillon.mp3')).toBe('Cendrillon')
  })

  it('turns underscores into spaces and collapses runs of spaces', () => {
    expect(titleFromFilename('Le_grand_méchant_loup.mp3')).toBe('Le grand méchant loup')
    expect(titleFromFilename('Trop    d   espaces.mp3')).toBe('Trop d espaces')
  })

  it('does not eat a number that belongs to the title', () => {
    expect(titleFromFilename('20 000 lieues sous les mers.mp3')).toBe('20 000 lieues sous les mers')
    expect(titleFromFilename('Ali Baba et les 40 voleurs.mp3')).toBe('Ali Baba et les 40 voleurs')
  })

  it('copes with an already clean name, and with an empty one', () => {
    expect(titleFromFilename('Cornebidouille')).toBe('Cornebidouille')
    expect(titleFromFilename('.mp3')).toBe('')
  })
})

describe('reviewSubmission — what blocks publication', () => {
  it('accepts a complete submission', () => {
    const review = reviewSubmission(complete())
    expect(review.blockers).toEqual([])
    expect(review.ready).toBe(true)
  })

  it('lists everything missing from an empty submission at once', () => {
    const codes = reviewSubmission(EMPTY_SUBMISSION).blockers.map((b) => b.code)
    expect(codes).toContain('no-title')
    expect(codes).toContain('no-cover')
    expect(codes).toContain('no-chapter')
    expect(codes).toContain('no-rights-status')
    expect(codes).toContain('no-rights-source')
    expect(codes).toContain('no-rights-declarant')
    expect(reviewSubmission(EMPTY_SUBMISSION).ready).toBe(false)
  })

  it('counts untitled chapters rather than repeating the blocker', () => {
    const submission = { ...complete(), chapters: [chapter(''), chapter(''), chapter('Titré')] }
    const blockers = reviewSubmission(submission).blockers.filter((b) => b.code === 'untitled-chapters')
    expect(blockers).toEqual([{ code: 'untitled-chapters', count: 2 }])
  })

  it('treats a whitespace-only title as missing', () => {
    expect(reviewSubmission({ ...complete(), title: '   ' }).blockers.map((b) => b.code)).toContain('no-title')
  })

  it('blocks past the 2 GiB release limit, and not just under it', () => {
    const under = { ...complete(), chapters: [chapter('Long', BYTES_LIMIT - 4096)] }
    const over = { ...complete(), chapters: [chapter('Trop long', BYTES_LIMIT + 1)] }
    expect(reviewSubmission(under).blockers.map((b) => b.code)).not.toContain('too-heavy')
    expect(reviewSubmission(over).blockers.map((b) => b.code)).toContain('too-heavy')
  })
})

describe('reviewSubmission — what is only worth knowing', () => {
  it('spots two chapters announced identically', () => {
    const submission = { ...complete(), chapters: [chapter('Le Loup'), chapter('le loup ')] }
    expect(reviewSubmission(submission).warnings.map((w) => w.code)).toContain('duplicate-titles')
  })

  it('never lets a warning block publication', () => {
    const submission = { ...complete(), description: '', chapters: [chapter('Seul')] }
    const review = reviewSubmission(submission)
    expect(review.warnings.length).toBeGreaterThan(0)
    expect(review.ready).toBe(true)
  })

  it('says how many chapters will fall back to the cover', () => {
    const submission = {
      ...complete(),
      chapters: [chapter('A'), { ...chapter('B'), image: file('b.jpg') }]
    }
    expect(reviewSubmission(submission).warnings).toContainEqual({
      code: 'chapters-without-image',
      count: 1,
      total: 2
    })
  })

  it('stays silent about images while no cover is set, since it cannot be the fallback', () => {
    const submission = { ...complete(), cover: null }
    expect(reviewSubmission(submission).warnings.map((w) => w.code)).not.toContain('chapters-without-image')
  })
})

describe('reviewSubmission — totals', () => {
  it('adds up audio, chapter images and the cover', () => {
    const submission = {
      ...complete(),
      cover: file('cover.jpg', 500),
      chapters: [{ ...chapter('A', 1000), image: file('a.jpg', 200) }, chapter('B', 3000)]
    }
    expect(reviewSubmission(submission).totalBytes).toBe(500 + 1000 + 200 + 3000)
  })

  it('withholds the total duration while one chapter is still unknown', () => {
    const submission = { ...complete(), chapters: [chapter('A', 1, 12), chapter('B', 1, null)] }
    expect(reviewSubmission(submission).totalDuration).toBeNull()
  })

  it('sums the durations once they are all known', () => {
    const submission = { ...complete(), chapters: [chapter('A', 1, 12), chapter('B', 1, 30)] }
    expect(reviewSubmission(submission).totalDuration).toBe(42)
  })
})

describe('chaptersFromFiles', () => {
  it('names each chapter from its file and leaves the duration unknown', () => {
    let n = 0
    const chapters = chaptersFromFiles([file('01 - Un.mp3'), file('02 - Deux.mp3')], () => `k${++n}`)
    expect(chapters.map((c) => c.title)).toEqual(['Un', 'Deux'])
    expect(chapters.map((c) => c.duration)).toEqual([null, null])
    expect(chapters.map((c) => c.key)).toEqual(['k1', 'k2'])
  })
})

describe('moveInList', () => {
  it('swaps with the neighbour', () => {
    expect(moveInList(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveInList(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either end, and never mutates the input', () => {
    const list = ['a', 'b']
    expect(moveInList(list, 0, -1)).toEqual(['a', 'b'])
    expect(moveInList(list, 1, 1)).toEqual(['a', 'b'])
    expect(list).toEqual(['a', 'b'])
  })
})
