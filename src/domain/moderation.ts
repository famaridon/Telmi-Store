import type { StoreEntry } from './model'
import type { ProposalComment } from './proposals'

/**
 * Moderating, seen from the person who answers.
 *
 * The valuable act here is not accepting — it is **refusing well**. A store is
 * judged as much on what it turned down as on what it published, so a reasoned
 * refusal must cost about as much as an acceptance.
 */

/** A proposal awaiting an answer, with everything needed to give one. */
export interface Awaiting {
  number: number
  url: string
  title: string
  author: string
  at: string
  /** Read back from the entry the proposal adds. */
  entry: StoreEntry
  /** Files the proposal touches, so anything unexpected is visible. */
  changed: string[]
  comments: ProposalComment[]
}

/** One chapter of a pack, ready to be played. */
export interface PlayableChapter {
  title: string
  /** Vault id, playable through the telmi-file protocol. */
  audioId: string
}

/** A pack opened for listening, without installing anything. */
export interface PlayablePack {
  title: string
  /** The question the storyteller asks before the menu, when there is one. */
  question: string
  chapters: PlayableChapter[]
  /** True when the downloaded pack matched the checksum in the entry. */
  checksumMatches: boolean
}

/**
 * The frequent reasons for a refusal.
 *
 * They exist so that saying no, with a reason, takes three clicks. A refusal
 * nobody has time to explain becomes a refusal nobody makes.
 */
export type DeclineReason =
  | 'rights-unclear'
  | 'rights-refused'
  | 'audio-quality'
  | 'off-scope'
  | 'duplicate'
  | 'other'
