import type {
  AudioToCopy,
  AudioToSpeak,
  ImageToDraw,
  PackNodes,
  PackNotes,
  PackPlan,
  Stage
} from '../pack'
import { COVER_SIZE, STAGE_SIZE } from '../pack'
import type { Submission } from '../model'

/**
 * Turning a submission into a pack.
 *
 * The graph is entirely mechanical, which is the good news: for N chapters there
 * is exactly one right answer, and it is testable without a device. The wiring
 * below is copied from a pack that works — see docs/format-pack.md.
 */

const chapterStage = (index: number): string => `s${index}`
const menuStage = (index: number): string => `m${index}`

/** Recopied verbatim: the storyteller uses it for its back button. */
const BACK_STAGE: Stage = {
  image: null,
  audio: null,
  ok: { action: 'backChildAction', index: 0 },
  home: { action: 'backAction', index: 0 },
  control: { ok: true, home: false, autoplay: true }
}

export const buildNodes = (
  chapterCount: number,
  hasSpokenQuestion: boolean,
  hasSpokenTitles: boolean
): PackNodes => {
  const stages: Record<string, Stage> = {
    backStage: BACK_STAGE,
    q: {
      image: null,
      // No spoken question until something records or synthesises it.
      audio: hasSpokenQuestion ? 'q.mp3' : null,
      ok: { action: 'm', index: 0 },
      home: { action: 'backAction', index: 0 },
      control: { ok: true, home: true, autoplay: true }
    }
  }

  const actions: Record<string, { stage: string }[]> = {
    q: [{ stage: 'q' }],
    m: [],
    backAction: [{ stage: 'backStage' }],
    backChildAction: []
  }

  for (let index = 0; index < chapterCount; index++) {
    const menu = menuStage(index)
    const chapter = chapterStage(index)

    stages[menu] = {
      image: `${menu}.png`,
      audio: hasSpokenTitles ? `${menu}.mp3` : null,
      ok: { action: chapter, index: 0 },
      home: { action: 'backAction', index: 0 },
      control: { ok: true, home: true, autoplay: false }
    }

    stages[chapter] = {
      image: null,
      audio: `${chapter}.mp3`,
      // The menu wraps: the last chapter sends the listener back to the first
      // entry rather than to an index that does not exist.
      ok: { action: 'm', index: (index + 1) % chapterCount },
      home: { action: 'm', index },
      control: { ok: false, home: true, autoplay: true }
    }

    actions['m']!.push({ stage: menu })
    actions[chapter] = [{ stage: chapter }]
  }

  return { startAction: { action: 'q', index: 0 }, stages, actions }
}

export const buildNotes = (submission: Submission): PackNotes => {
  const notes: PackNotes = {
    q: { title: 'Question', notes: submission.question }
  }
  submission.chapters.forEach((chapter, index) => {
    notes[menuStage(index)] = { title: menuStage(index), notes: chapter.title }
    notes[chapterStage(index)] = { title: chapter.title, notes: '' }
  })
  return notes
}

/** A file name that survives every filesystem, derived from a title. */
export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'histoire'

export interface PackIdentity {
  /** Must stay the same across versions, or no update is ever detected. */
  uuid: string
  /** Integer >= 1. */
  version: number
  /**
   * Whether the menu labels will be spoken. False until a voice exists: the
   * titles are then burnt into the images and the labels stay silent.
   */
  spokenTitles?: boolean
}

/**
 * The single place that decides a pack's entire content.
 *
 * The interface only draws what this plan names, and the writer only writes what
 * it lists — so a mistake here is a test failure, not a broken pack found weeks
 * later on a device.
 */
export const planPack = (submission: Submission, identity: PackIdentity): PackPlan => {
  const images: ImageToDraw[] = []
  const audios: AudioToCopy[] = []
  const total = submission.chapters.length
  const spokenTitles = identity.spokenTitles ?? false

  // title.mp3 is a marker: it exists in every pack, spoken or silent.
  const spoken: AudioToSpeak[] = [{ path: 'title.mp3', text: submission.title }]
  if (spokenTitles) {
    if (submission.question.trim() !== '') {
      spoken.push({ path: 'audios/q.mp3', text: submission.question })
    }
    submission.chapters.forEach((chapter, index) => {
      spoken.push({ path: `audios/${menuStage(index)}.mp3`, text: chapter.title })
    })
  }

  // The cover is required by the form, so it is present by the time we get here.
  const coverId = submission.cover?.id ?? ''

  images.push({
    path: 'cover.png',
    sourceId: coverId,
    ...COVER_SIZE,
    caption: null,
    pagination: null
  })

  // title.png is one of the four markers, and shows the pack's own name.
  images.push({
    path: 'title.png',
    sourceId: coverId,
    ...STAGE_SIZE,
    caption: submission.title,
    pagination: null
  })

  submission.chapters.forEach((chapter, index) => {
    images.push({
      path: `images/${menuStage(index)}.png`,
      // A chapter without its own image falls back to the cover.
      sourceId: chapter.image?.id ?? coverId,
      ...STAGE_SIZE,
      caption: chapter.title,
      pagination: `${index + 1}/${total}`
    })
    audios.push({ path: `audios/${chapterStage(index)}.mp3`, sourceId: chapter.audio.id })
  })

  return {
    metadata: {
      title: submission.title,
      uuid: identity.uuid,
      image: 'cover.png',
      version: identity.version,
      category: submission.category,
      description: submission.description,
      age: submission.minAge
    },
    nodes: buildNodes(total, spokenTitles && submission.question.trim() !== '', spokenTitles),
    notes: buildNotes(submission),
    images,
    audios,
    spoken,
    archiveName: slugify(submission.title)
  }
}

/**
 * A uuid that identifies a story for good.
 *
 * Two constraints, and they pull in opposite directions: it must never collide
 * between two contributors, and it must stay IDENTICAL across the versions of
 * one story — otherwise Telmi-Sync sees an unrelated story rather than an
 * update. Hence a random value, generated once and then carried along.
 */
export const packUuid = (random: string): string => `fffffc-${slugify(random).slice(0, 30)}`
