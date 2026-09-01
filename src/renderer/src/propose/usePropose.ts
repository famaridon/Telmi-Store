import { useCallback, useEffect, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { StoreEntry } from '@domain/model'
import type { PackFile } from '@domain/ports'
import type { Proposed } from '@domain/propose'
import { entryFileName, entryToJson, thumbnailFileName, THUMBNAIL_SIZE } from '@domain/rules/entry'
import { drawPackImage } from '../build/drawImage'
import { proposalBody, proposalTitle } from './proseDeLaProposition'

export type ProposeState =
  | { step: 'idle' }
  | { step: 'sending' }
  | { step: 'done'; proposed: Proposed }

export interface Propose {
  /** Which store the proposal goes to, as the application decided. */
  store: string | null
  state: ProposeState
  error: AppError | null
  propose: (entry: StoreEntry, packUrl: string, coverId: string) => void
  open: () => void
  dismissError: () => void
}

export const usePropose = (): Propose => {
  const [store, setStore] = useState<string | null>(null)
  const [state, setState] = useState<ProposeState>({ step: 'idle' })
  const [error, setError] = useState<AppError | null>(null)

  useEffect(() => {
    void window.telmi.propose.store().then((answer) => {
      if (answer.ok) setStore(answer.value)
      else setError(answer.error)
    })
  }, [])

  const propose = useCallback(
    (entry: StoreEntry, packUrl: string, coverId: string) => {
      if (store === null) return
      setError(null)
      setState({ step: 'sending' })

      void (async () => {
        // The thumbnail the store lists the story with — drawn from the cover,
        // and demanded by the store's own checker beside the entry.
        let thumbnail: Uint8Array
        try {
          thumbnail = await drawPackImage({
            path: thumbnailFileName(entry),
            sourceId: coverId,
            ...THUMBNAIL_SIZE,
            caption: null,
            pagination: null
          })
        } catch {
          setState({ step: 'idle' })
          setError({ code: 'pack/missing-image', path: thumbnailFileName(entry) })
          return
        }

        const files: PackFile[] = [
          {
            path: entryFileName(entry),
            bytes: new TextEncoder().encode(JSON.stringify(entryToJson(entry), null, 2) + '\n')
          },
          { path: thumbnailFileName(entry), bytes: thumbnail }
        ]

        const answer = await window.telmi.propose.entry({
          storeRepo: store,
          entry,
          files,
          title: proposalTitle(entry),
          body: proposalBody(entry, packUrl)
        })

        if (answer.ok) setState({ step: 'done', proposed: answer.value })
        else {
          setState({ step: 'idle' })
          setError(answer.error)
        }
      })()
    },
    [store]
  )

  const open = useCallback(() => {
    void window.telmi.propose.open().then((answer) => {
      if (!answer.ok) setError(answer.error)
    })
  }, [])

  return { store, state, error, propose, open, dismissError: () => setError(null) }
}
