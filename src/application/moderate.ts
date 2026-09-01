import { fail, type Result } from '@domain/errors'
import type { Awaiting, PlayablePack } from '@domain/moderation'
import type { Ports } from '@domain/ports'
import { packUrlOf } from '@domain/rules/moderation'

/**
 * Moderating a store.
 *
 * Each use case checks the token, and nothing more: the orderings that matter —
 * saying why before closing, unzipping rather than installing — belong to the
 * adapters that own them.
 */
const withToken = async <T>(
  ports: Ports,
  work: (token: string) => Promise<Result<T>>
): Promise<Result<T>> => {
  const token = await ports.tokens.read()
  if (!token.ok) return token
  if (token.value === null) return fail({ code: 'auth/no-session' })
  return work(token.value)
}

export const mayModerate = (ports: Ports, storeRepo: string): Promise<Result<boolean>> =>
  withToken(ports, (token) => ports.moderation.mayModerate(token, storeRepo))

export const awaitingAnswer = (ports: Ports, storeRepo: string): Promise<Result<Awaiting[]>> =>
  withToken(ports, (token) => ports.moderation.awaiting(token, storeRepo))

export const acceptProposal = (
  ports: Ports,
  storeRepo: string,
  number: number,
  comment: string
): Promise<Result<void>> =>
  withToken(ports, (token) => ports.moderation.accept(token, storeRepo, number, comment))

export const declineProposal = (
  ports: Ports,
  storeRepo: string,
  number: number,
  comment: string
): Promise<Result<void>> =>
  withToken(ports, (token) => ports.moderation.decline(token, storeRepo, number, comment))

/**
 * Opens the pack a proposal points at, so it can be heard.
 *
 * The address is derived from the entry rather than taken from the interface:
 * a moderator listens to what the proposal actually declares.
 */
export const listenTo = async (ports: Ports, proposal: Awaiting): Promise<Result<PlayablePack>> => {
  const url = packUrlOf(proposal.entry.pack)
  if (url === '') return fail({ code: 'pack/unreadable-archive', cause: 'la fiche ne dit pas ou est le pack' })
  return ports.packReader.open(url, proposal.entry.pack.sha256)
}
