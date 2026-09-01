import { useCallback, useEffect, useState } from 'react'
import type { DeviceCode, Identity } from '@domain/auth'
import type { AppError } from '@domain/errors'

/**
 * The five states a contributor can be in, as seen from the interface.
 *
 * `waiting` is the whole point of the Device Flow: the code is on screen, the
 * contributor is typing it in a browser, and we are polling GitHub in the
 * background. Nothing more happens here until they approve.
 */
export type AccountState =
  | { step: 'loading' }
  | { step: 'anonymous' }
  | { step: 'starting' }
  | { step: 'waiting'; code: DeviceCode }
  | { step: 'signedIn'; identity: Identity; scopes: string[] }

export interface Account {
  state: AccountState
  error: AppError | null
  signIn: () => void
  cancel: () => void
  signOut: () => void
  openVerification: () => void
  dismissError: () => void
}

export const useAccount = (): Account => {
  const [state, setState] = useState<AccountState>({ step: 'loading' })
  const [error, setError] = useState<AppError | null>(null)

  // A token kept from a previous run means the contributor is already signed in.
  useEffect(() => {
    void window.telmi.auth.restore().then((answer) => {
      if (!answer.ok) {
        setError(answer.error)
        setState({ step: 'anonymous' })
        return
      }
      setState(
        answer.value === null
          ? { step: 'anonymous' }
          : { step: 'signedIn', identity: answer.value.identity, scopes: answer.value.scopes }
      )
    })
  }, [])

  // The code arrives while `signIn()` is still pending: it is an event, not a
  // return value, because the interface has to show it before anything happens.
  useEffect(
    () =>
      window.telmi.on('auth:code', (code) => {
        setState({ step: 'waiting', code })
      }),
    []
  )

  const signIn = useCallback(() => {
    setError(null)
    setState({ step: 'starting' })
    void window.telmi.auth.signIn().then((answer) => {
      if (answer.ok) {
        setState({ step: 'signedIn', identity: answer.value.identity, scopes: answer.value.scopes })
      }
      else {
        // A cancellation is a choice, not a failure worth reporting.
        if (answer.error.code !== 'auth/cancelled') setError(answer.error)
        setState({ step: 'anonymous' })
      }
    })
  }, [])

  const cancel = useCallback(() => {
    void window.telmi.auth.cancel()
  }, [])

  const signOut = useCallback(() => {
    void window.telmi.auth.signOut().then((answer) => {
      if (!answer.ok) setError(answer.error)
      setState({ step: 'anonymous' })
    })
  }, [])

  const openVerification = useCallback(() => {
    void window.telmi.auth.openVerification().then((answer) => {
      if (!answer.ok) setError(answer.error)
    })
  }, [])

  return {
    state,
    error,
    signIn,
    cancel,
    signOut,
    openVerification,
    dismissError: () => setError(null)
  }
}
