import { fail, type Result } from '@domain/errors'
import type { Ports } from '@domain/ports'
import type { Proposed, ProposeRequest } from '@domain/propose'

/**
 * Proposing an entry to a store.
 *
 * Thin on purpose: the six REST calls belong to the adapter, and the only rule
 * this layer holds is that a proposal needs a signed-in contributor.
 */
export const proposeEntry = async (
  ports: Ports,
  request: ProposeRequest
): Promise<Result<Proposed>> => {
  const token = await ports.tokens.read()
  if (!token.ok) return token
  if (token.value === null) return fail({ code: 'auth/no-session' })
  return ports.pulls.propose(token.value, request)
}
