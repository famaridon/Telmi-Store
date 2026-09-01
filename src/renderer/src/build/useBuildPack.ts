import { useCallback, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { BuiltPack } from '@domain/pack'
import type { Submission } from '@domain/model'
import { packUuid, planPack } from '@domain/rules/pack'
import type { PackFile } from '@domain/ports'
import { drawPackImage } from './drawImage'

/** Where the build has got to, for something honest to show on screen. */
export type BuildState =
  | { step: 'idle' }
  | { step: 'drawing'; done: number; total: number }
  | { step: 'writing' }
  | { step: 'done'; pack: BuiltPack }

export interface BuildPack {
  state: BuildState
  error: AppError | null
  build: (submission: Submission, uuid: string, voices: PackFile[], spokenTitles: boolean) => void
  reveal: () => void
  reset: () => void
  dismissError: () => void
}

export const useBuildPack = (): BuildPack => {
  const [state, setState] = useState<BuildState>({ step: 'idle' })
  const [error, setError] = useState<AppError | null>(null)

  const build = useCallback(
    (submission: Submission, uuid: string, voices: PackFile[], spokenTitles: boolean) => {
    setError(null)

    void (async () => {
      const plan = planPack(submission, { uuid: packUuid(uuid), version: 1, spokenTitles })

      const images: PackFile[] = []
      setState({ step: 'drawing', done: 0, total: plan.images.length })
      for (const [index, spec] of plan.images.entries()) {
        try {
          images.push({ path: spec.path, bytes: await drawPackImage(spec) })
        } catch (e) {
          setState({ step: 'idle' })
          setError({ code: 'pack/missing-image', path: spec.path })
          void e
          return
        }
        setState({ step: 'drawing', done: index + 1, total: plan.images.length })
      }

      setState({ step: 'writing' })
      // The writer keeps only the voices the plan asked for, and puts silence
      // where a label was not recorded.
      const written = await window.telmi.packs.build(plan, [...images, ...voices])
      if (written.ok) setState({ step: 'done', pack: written.value })
      else {
        setState({ step: 'idle' })
        setError(written.error)
      }
    })()
    },
    []
  )

  const reveal = useCallback(() => {
    void window.telmi.packs.reveal().then((answer) => {
      if (!answer.ok) setError(answer.error)
    })
  }, [])

  return {
    state,
    error,
    build,
    reveal,
    reset: () => setState({ step: 'idle' }),
    dismissError: () => setError(null)
  }
}
