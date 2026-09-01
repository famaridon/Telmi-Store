import type { Chapter, PickedFile, RightsStatus, Submission } from '../model'

/** 2 GiB: the size limit of one file attached to a GitHub release. */
export const BYTES_LIMIT = 2 * 1024 ** 3

/** Past this, publishing takes long enough that the contributor should know. */
const BYTES_SLOW = 500 * 1024 ** 2

/**
 * A submission with nothing in it yet.
 *
 * `question` is left empty on purpose: its default wording is French, therefore
 * presentation, and it is supplied by the interface. Nothing under domain/ holds
 * a sentence a user could read — a rule enforced by tests/architecture.test.ts.
 */
export const EMPTY_SUBMISSION: Submission = {
  title: '',
  minAge: 3,
  category: '',
  language: 'fr',
  description: '',
  question: '',
  cover: null,
  chapters: [],
  rights: { status: '', source: '', declaredBy: '' }
}

export const RIGHTS_STATUSES: readonly RightsStatus[] = [
  'own-work',
  'public-domain',
  'cc-by',
  'cc-by-sa',
  'written-permission'
]

/**
 * Readable title from a file name: "03 - Le Loup.mp3" -> "Le Loup".
 *
 * The title is what the storyteller says out loud, so it is worth cleaning: a
 * leading track number is scaffolding, not part of the title. A number followed
 * by a space is left alone, otherwise "20 000 lieues" loses its beginning.
 */
export const titleFromFilename = (name: string): string =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/^[\s\d]+[-_.)\]]\s*/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** What must be fixed before a pack can be built. */
export type Blocker =
  | { code: 'no-title' }
  | { code: 'no-cover' }
  | { code: 'no-chapter' }
  | { code: 'untitled-chapters'; count: number }
  | { code: 'no-rights-status' }
  | { code: 'no-rights-source' }
  | { code: 'no-rights-declarant' }
  | { code: 'too-heavy'; bytes: number }

/** Worth knowing, but never blocking. */
export type Warning =
  | { code: 'duplicate-titles' }
  | { code: 'chapters-without-image'; count: number; total: number }
  | { code: 'slow-upload'; bytes: number }
  | { code: 'no-description' }

export interface SubmissionReview {
  blockers: Blocker[]
  warnings: Warning[]
  totalBytes: number
  /** Null while any chapter duration is still unknown. */
  totalDuration: number | null
  ready: boolean
}

export const totalBytesOf = (submission: Submission): number =>
  submission.chapters.reduce((sum, c) => sum + c.audio.bytes + (c.image?.bytes ?? 0), 0) +
  (submission.cover?.bytes ?? 0)

const totalDurationOf = (chapters: Chapter[]): number | null => {
  if (chapters.length === 0) return null
  if (chapters.some((c) => c.duration === null)) return null
  return chapters.reduce((sum, c) => sum + (c.duration ?? 0), 0)
}

/**
 * The single source of truth for "is this story publishable".
 *
 * Pure and framework-free on purpose: the submission screen shows it, and the
 * moderation screen will apply the same reading to what it receives.
 */
export const reviewSubmission = (submission: Submission): SubmissionReview => {
  const blockers: Blocker[] = []
  const warnings: Warning[] = []
  const totalBytes = totalBytesOf(submission)

  if (submission.title.trim() === '') blockers.push({ code: 'no-title' })
  if (submission.cover === null) blockers.push({ code: 'no-cover' })
  if (submission.chapters.length === 0) blockers.push({ code: 'no-chapter' })

  const untitled = submission.chapters.filter((c) => c.title.trim() === '').length
  if (untitled > 0) blockers.push({ code: 'untitled-chapters', count: untitled })

  if (submission.rights.status === '') blockers.push({ code: 'no-rights-status' })
  if (submission.rights.source.trim() === '') blockers.push({ code: 'no-rights-source' })
  if (submission.rights.declaredBy.trim() === '') blockers.push({ code: 'no-rights-declarant' })

  if (totalBytes > BYTES_LIMIT) blockers.push({ code: 'too-heavy', bytes: totalBytes })

  const titles = submission.chapters.map((c) => c.title.trim().toLowerCase()).filter((t) => t !== '')
  if (new Set(titles).size !== titles.length) warnings.push({ code: 'duplicate-titles' })

  const withoutImage = submission.chapters.filter((c) => c.image === null).length
  if (withoutImage > 0 && submission.cover !== null) {
    warnings.push({ code: 'chapters-without-image', count: withoutImage, total: submission.chapters.length })
  }

  if (totalBytes > BYTES_SLOW && totalBytes <= BYTES_LIMIT) {
    warnings.push({ code: 'slow-upload', bytes: totalBytes })
  }

  if (submission.description.trim() === '') warnings.push({ code: 'no-description' })

  return {
    blockers,
    warnings,
    totalBytes,
    totalDuration: totalDurationOf(submission.chapters),
    ready: blockers.length === 0
  }
}

/** Builds the chapters for freshly picked audio files. */
export const chaptersFromFiles = (files: PickedFile[], nextKey: () => string): Chapter[] =>
  files.map((audio) => ({
    key: nextKey(),
    title: titleFromFilename(audio.name),
    audio,
    duration: null,
    image: null
  }))

export const moveInList = <T>(list: readonly T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list]
  const copy = [...list]
  const held = copy[index]!
  copy[index] = copy[target]!
  copy[target] = held
  return copy
}
