import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppError } from '@domain/errors'

/**
 * Recording one label at a time.
 *
 * The microphone stream stays open while this screen is on show — so the system
 * indicator stays lit, which is honest — and is released as soon as the screen
 * goes away.
 */

/** A label is a few words: past this, something has been left running. */
const MAX_SECONDS = 15

export type RecorderState = { step: 'idle' } | { step: 'recording'; path: string; seconds: number }

export interface Recorder {
  state: RecorderState
  error: AppError | null
  start: (path: string) => void
  stop: () => void
  dismissError: () => void
}

export const useRecorder = (onRecorded: (path: string, recording: ArrayBuffer) => void): Recorder => {
  const [state, setState] = useState<RecorderState>({ step: 'idle' })
  const [error, setError] = useState<AppError | null>(null)

  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const ticker = useRef<number | null>(null)

  // Release the microphone when the screen goes away, indicator included.
  useEffect(
    () => () => {
      recorder.current?.state === 'recording' && recorder.current.stop()
      for (const track of stream.current?.getTracks() ?? []) track.stop()
      stream.current = null
      if (ticker.current !== null) window.clearInterval(ticker.current)
    },
    []
  )

  const openMicrophone = async (): Promise<MediaStream | null> => {
    if (stream.current !== null) return stream.current
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      return stream.current
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? { code: 'voice/denied' }
          : { code: 'voice/no-microphone', cause: e instanceof Error ? e.message : String(e) }
      )
      return null
    }
  }

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(
    (path: string) => {
      setError(null)
      void (async () => {
        if (recorder.current?.state === 'recording') recorder.current.stop()

        const media = await openMicrophone()
        if (media === null) return

        const supported = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        const instance = new MediaRecorder(media, supported ? { mimeType: 'audio/webm;codecs=opus' } : {})
        const chunks: Blob[] = []

        instance.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        })

        instance.addEventListener('stop', () => {
          if (ticker.current !== null) window.clearInterval(ticker.current)
          ticker.current = null
          setState({ step: 'idle' })
          recorder.current = null
          if (chunks.length > 0) {
            void new Blob(chunks).arrayBuffer().then((recording) => onRecorded(path, recording))
          }
        })

        recorder.current = instance
        instance.start()

        const startedAt = Date.now()
        setState({ step: 'recording', path, seconds: 0 })
        ticker.current = window.setInterval(() => {
          const seconds = (Date.now() - startedAt) / 1000
          if (seconds >= MAX_SECONDS) return stop()
          setState({ step: 'recording', path, seconds })
        }, 100)
      })()
    },
    [onRecorded, stop]
  )

  return { state, error, start, stop, dismissError: () => setError(null) }
}
