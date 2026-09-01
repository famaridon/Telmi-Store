import { describe, expect, it } from 'vitest'
import type { Proposal, RawPull } from '@domain/proposals'
import { proposalStateOf, slugFromBranch, sortProposals, toProposal } from '@domain/rules/proposals'

const pull = (over: Partial<RawPull> = {}): RawPull => ({
  number: 1,
  url: 'https://github.com/pr/1',
  title: 'Le Loup (3+)',
  branch: 'proposition/le-loup',
  author: 'contributeur',
  closed: false,
  merged: false,
  at: '2026-09-01T10:00:00Z',
  lastReview: null,
  comments: [],
  ...over
})

describe('proposalStateOf — reading a pull request as a contributor would', () => {
  it('reads an untouched proposal as still under review', () => {
    expect(proposalStateOf(pull())).toBe('under-review')
  })

  it('reads a request for changes as something to fix', () => {
    expect(proposalStateOf(pull({ lastReview: 'changes-requested' }))).toBe('changes-requested')
  })

  it('reads a merged proposal as accepted, whatever the reviews said on the way', () => {
    expect(proposalStateOf(pull({ merged: true, closed: true, lastReview: 'changes-requested' }))).toBe('accepted')
  })

  it('reads a closed proposal that was never merged as a refusal', () => {
    expect(proposalStateOf(pull({ closed: true, lastReview: 'commented' }))).toBe('declined')
  })

  it('does not mistake an approval for an acceptance: merging is what counts', () => {
    expect(proposalStateOf(pull({ lastReview: 'approved' }))).toBe('under-review')
  })

  it('leaves a plain comment as still under review', () => {
    expect(proposalStateOf(pull({ lastReview: 'commented' }))).toBe('under-review')
  })
})

describe('slugFromBranch', () => {
  it('reads the story out of the branch we create', () => {
    expect(slugFromBranch('proposition/les-contes-de-la-mere-pauline')).toBe('les-contes-de-la-mere-pauline')
  })

  it('leaves a branch that is not ours alone', () => {
    expect(slugFromBranch('main')).toBe('main')
    expect(slugFromBranch('feature/x')).toBe('feature/x')
  })
})

describe('toProposal', () => {
  it('shows what was said oldest first, whatever order it arrived in', () => {
    const proposal = toProposal(
      pull({
        comments: [
          { author: 'b', body: 'ensuite', at: '2026-09-02T10:00:00Z' },
          { author: 'a', body: 'd’abord', at: '2026-09-01T10:00:00Z' }
        ]
      }),
      'famaridon/telmi-store-dev'
    )
    expect(proposal.comments.map((c) => c.body)).toEqual(['d’abord', 'ensuite'])
  })

  it('carries the store it was proposed to', () => {
    expect(toProposal(pull(), 'famaridon/telmi-store-dev').storeRepo).toBe('famaridon/telmi-store-dev')
  })
})

describe('sortProposals — what needs attention comes to the top', () => {
  const at = (state: Proposal['state'], date: string, number: number): Proposal =>
    toProposal(
      pull({
        number,
        at: date,
        closed: state === 'declined' || state === 'accepted',
        merged: state === 'accepted',
        lastReview: state === 'changes-requested' ? 'changes-requested' : null
      }),
      'store'
    )

  it('puts what must be fixed first, then what waits, then what is settled', () => {
    const sorted = sortProposals([
      at('accepted', '2026-09-05T00:00:00Z', 1),
      at('under-review', '2026-09-04T00:00:00Z', 2),
      at('declined', '2026-09-03T00:00:00Z', 3),
      at('changes-requested', '2026-09-01T00:00:00Z', 4)
    ])
    expect(sorted.map((p) => p.state)).toEqual([
      'changes-requested',
      'under-review',
      'accepted',
      'declined'
    ])
  })

  it('within one state, shows the most recent first', () => {
    const sorted = sortProposals([
      at('under-review', '2026-09-01T00:00:00Z', 1),
      at('under-review', '2026-09-09T00:00:00Z', 2)
    ])
    expect(sorted.map((p) => p.number)).toEqual([2, 1])
  })

  it('never mutates the list it was given', () => {
    const list = [at('accepted', '2026-09-01T00:00:00Z', 1), at('changes-requested', '2026-09-02T00:00:00Z', 2)]
    sortProposals(list)
    expect(list.map((p) => p.number)).toEqual([1, 2])
  })
})
