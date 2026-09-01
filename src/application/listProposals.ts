import { fail, type Result } from '@domain/errors'
import type { Ports } from '@domain/ports'
import type { Proposal } from '@domain/proposals'

/** The contributor's own proposals to a store, and what was said on them. */
export const listProposals = async (ports: Ports, storeRepo: string): Promise<Result<Proposal[]>> => {
  const token = await ports.tokens.read()
  if (!token.ok) return token
  if (token.value === null) return fail({ code: 'auth/no-session' })
  return ports.pulls.mine(token.value, storeRepo)
}
