import { useCallback, useEffect, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { Proposal } from '@domain/proposals'

export interface Proposals {
  proposals: Proposal[] | null
  error: AppError | null
  refresh: () => void
  open: () => void
  dismissError: () => void
}

export const useProposals = (enabled: boolean): Proposals => {
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(() => {
    if (!enabled) return
    setProposals(null)
    void window.telmi.propose.mine().then((answer) => {
      if (answer.ok) setProposals(answer.value)
      else {
        setError(answer.error)
        setProposals([])
      }
    })
  }, [enabled])

  useEffect(refresh, [refresh])

  return {
    proposals,
    error,
    refresh,
    open: () => {
      void window.telmi.propose.open()
    },
    dismissError: () => setError(null)
  }
}
