import type { Proposal, ProposalState, RawPull } from '../proposals'

/**
 * Reading a pull request the way a contributor would.
 *
 * The order of the tests matters: a merged proposal is accepted whatever its
 * reviews said along the way, and a closed one that was never merged is a
 * refusal even if the last review had only commented.
 */
export const proposalStateOf = (pull: Pick<RawPull, 'closed' | 'merged' | 'lastReview'>): ProposalState => {
  if (pull.merged) return 'accepted'
  if (pull.closed) return 'declined'
  if (pull.lastReview === 'changes-requested') return 'changes-requested'
  return 'under-review'
}

/** The story a proposal carries, read from the branch it lives on. */
export const slugFromBranch = (branch: string): string =>
  branch.startsWith('proposition/') ? branch.slice('proposition/'.length) : branch

export const toProposal = (pull: RawPull, storeRepo: string): Proposal => ({
  number: pull.number,
  url: pull.url,
  title: pull.title,
  storeRepo,
  slug: slugFromBranch(pull.branch),
  state: proposalStateOf(pull),
  at: pull.at,
  comments: [...pull.comments].sort((a, b) => a.at.localeCompare(b.at))
})

/** Waiting first, then the most recent: what needs attention comes to the top. */
const RANK: Record<ProposalState, number> = {
  'changes-requested': 0,
  'under-review': 1,
  accepted: 2,
  declined: 3
}

export const sortProposals = (proposals: Proposal[]): Proposal[] =>
  [...proposals].sort(
    (a, b) => RANK[a.state] - RANK[b.state] || b.at.localeCompare(a.at)
  )
