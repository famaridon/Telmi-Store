import { useCallback, useMemo, useRef, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { Submission } from '@domain/model'
import type { AudioToSpeak } from '@domain/pack'
import type { PackFile } from '@domain/ports'
import { spokenLabels } from '@domain/rules/pack'
import { encodeMp3 } from './encodeMp3'

/** One recorded label, ready to go into the pack and to be played back. */
interface Voice {
  mp3: Uint8Array
  seconds: number
  /** For the little playback button. Revoked when replaced. */
  url: string
}

export interface Voices {
  /** Every label that could be spoken, in the order they are said. */
  labels: AudioToSpeak[]
  recorded: ReadonlyMap<string, Voice>
  /** True once every menu label has a voice: only then are they used. */
  complete: boolean
  missing: number
  error: AppError | null
  keep: (path: string, recording: ArrayBuffer) => Promise<void>
  drop: (path: string) => void
  dropAll: () => void
  /** What to hand the writer, alongside the drawn images. */
  files: () => PackFile[]
  dismissError: () => void
}

export const useVoices = (submission: Submission): Voices => {
  const [recorded, setRecorded] = useState<ReadonlyMap<string, Voice>>(new Map())
  const [error, setError] = useState<AppError | null>(null)
  const urls = useRef<string[]>([])

  // Every label, including the menu ones, so the screen can offer them all.
  const labels = useMemo(() => spokenLabels(submission, true), [submission])

  /** The menu labels: the ones that decide whether titles are spoken at all. */
  const menuLabels = useMemo(() => labels.filter((label) => label.path !== 'title.mp3'), [labels])

  const keep = useCallback(async (path: string, recording: ArrayBuffer): Promise<void> => {
    try {
      const mp3 = await encodeMp3(recording)
      const url = URL.createObjectURL(new Blob([mp3.slice()], { type: 'audio/mpeg' }))
      urls.current.push(url)
      const decoded = await new Promise<number>((resolve) => {
        const element = new Audio(url)
        element.addEventListener('loadedmetadata', () => resolve(element.duration), { once: true })
        element.addEventListener('error', () => resolve(0), { once: true })
      })
      setRecorded((previous) => new Map(previous).set(path, { mp3, seconds: decoded, url }))
    } catch (e) {
      setError({ code: 'voice/encoding-failed', cause: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  const drop = useCallback((path: string) => {
    setRecorded((previous) => {
      const next = new Map(previous)
      next.delete(path)
      return next
    })
  }, [])

  const dropAll = useCallback(() => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current = []
    setRecorded(new Map())
  }, [])

  const missing = menuLabels.filter((label) => !recorded.has(label.path)).length

  return {
    labels,
    recorded,
    // A pack with half its labels spoken would be worse than one with none:
    // the child hears a voice, then silence, and cannot tell why.
    complete: menuLabels.length > 0 && missing === 0,
    missing,
    error,
    keep,
    drop,
    dropAll,
    files: () => [...recorded].map(([path, voice]) => ({ path, bytes: voice.mp3 })),
    dismissError: () => setError(null)
  }
}
