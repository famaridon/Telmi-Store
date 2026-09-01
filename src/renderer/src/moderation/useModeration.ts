import { useCallback, useEffect, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { Awaiting, PlayablePack } from '@domain/moderation'

export interface Moderation {
  /** Null while unknown, false when this account may not answer. */
  allowed: boolean | null
  awaiting: Awaiting[] | null
  /** The pack currently open for listening, by proposal number. */
  listening: { number: number; pack: PlayablePack } | null
  busy: number | null
  error: AppError | null
  refresh: () => void
  listen: (proposal: Awaiting) => void
  closePlayer: () => void
  accept: (number: number, comment: string) => void
  decline: (number: number, comment: string) => void
  dismissError: () => void
}

export const useModeration = (enabled: boolean): Moderation => {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [awaiting, setAwaiting] = useState<Awaiting[] | null>(null)
  const [listening, setListening] = useState<{ number: number; pack: PlayablePack } | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(() => {
    if (!enabled) return
    setAwaiting(null)
    void window.telmi.moderate.awaiting().then((answer) => {
      if (answer.ok) setAwaiting(answer.value)
      else {
        setError(answer.error)
        setAwaiting([])
      }
    })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void window.telmi.moderate.allowed().then((answer) => {
      if (answer.ok) setAllowed(answer.value)
      else {
        setAllowed(false)
        setError(answer.error)
      }
    })
  }, [enabled])

  useEffect(() => {
    if (allowed === true) refresh()
  }, [allowed, refresh])

  const listen = useCallback((proposal: Awaiting) => {
    setError(null)
    setBusy(proposal.number)
    void window.telmi.moderate.listen(proposal).then((answer) => {
      setBusy(null)
      if (answer.ok) setListening({ number: proposal.number, pack: answer.value })
      else setError(answer.error)
    })
  }, [])

  const answer = useCallback(
    (kind: 'accept' | 'decline', number: number, comment: string) => {
      setError(null)
      setBusy(number)
      const call = kind === 'accept' ? window.telmi.moderate.accept : window.telmi.moderate.decline
      void call(number, comment).then((result) => {
        setBusy(null)
        if (!result.ok) return setError(result.error)
        setListening((current) => (current?.number === number ? null : current))
        refresh()
      })
    },
    [refresh]
  )

  return {
    allowed,
    awaiting,
    listening,
    busy,
    error,
    refresh,
    listen,
    closePlayer: () => setListening(null),
    accept: (number, comment) => answer('accept', number, comment),
    decline: (number, comment) => answer('decline', number, comment),
    dismissError: () => setError(null)
  }
}
