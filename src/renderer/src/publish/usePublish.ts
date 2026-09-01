import { useCallback, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { Submission } from '@domain/model'
import type { BuiltPack } from '@domain/pack'
import type { Published } from '@domain/publish'

/** Where the publication has got to, for something honest to show. */
export type PublishState =
  | { step: 'idle' }
  | { step: 'sending'; sent: number; total: number | null }
  | { step: 'done'; published: Published }

export interface Publish {
  state: PublishState
  error: AppError | null
  publish: (submission: Submission, pack: BuiltPack, uuid: string, login: string) => void
  reset: () => void
  dismissError: () => void
}

export const usePublish = (): Publish => {
  const [state, setState] = useState<PublishState>({ step: 'idle' })
  const [error, setError] = useState<AppError | null>(null)

  const publish = useCallback(
    (submission: Submission, pack: BuiltPack, uuid: string, login: string) => {
      setError(null)
      setState({ step: 'sending', sent: 0, total: pack.bytes })

      const unsubscribe = window.telmi.on('publish:progress', ({ sent, total }) => {
        setState({ step: 'sending', sent, total })
      })

      void window.telmi.publish
        .pack({ submission, pack, uuid, version: 1, login })
        .then((answer) => {
          unsubscribe()
          if (answer.ok) setState({ step: 'done', published: answer.value })
          else {
            // Deliberately back to idle rather than a dead end: every step is
            // resumable, so the honest thing to offer is « relance ».
            setState({ step: 'idle' })
            setError(answer.error)
          }
        })
    },
    []
  )

  return {
    state,
    error,
    publish,
    reset: () => setState({ step: 'idle' }),
    dismissError: () => setError(null)
  }
}
