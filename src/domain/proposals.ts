/**
 * Following a proposal, as the contributor sees it.
 *
 * GitHub speaks of open, closed, merged and reviews; a contributor wants to know
 * whether someone is still looking, whether it went in, or whether it was turned
 * down — and what was said. The translation is a domain rule, not a detail of the
 * adapter.
 */

export type ProposalState =
  /** Nobody has answered yet. The common case, and not a bad sign. */
  | 'under-review'
  /** Someone asked for something to be fixed. */
  | 'changes-requested'
  /** It went in. */
  | 'accepted'
  /** It was turned down. */
  | 'declined'

export interface ProposalComment {
  author: string
  body: string
  /** ISO date, as GitHub gives it. */
  at: string
}

export interface Proposal {
  number: number
  url: string
  title: string
  /** « owner/name » of the store it was proposed to. */
  storeRepo: string
  /** The story it carries, read from the branch name. */
  slug: string
  state: ProposalState
  at: string
  /** What was said, oldest first. */
  comments: ProposalComment[]
}

/** What GitHub tells us about a pull request, before we make sense of it. */
export interface RawPull {
  number: number
  url: string
  title: string
  branch: string
  author: string
  closed: boolean
  merged: boolean
  at: string
  /** The state of the last review, when there is one. */
  lastReview: 'approved' | 'changes-requested' | 'commented' | null
  comments: ProposalComment[]
}
