import { useEffect } from 'react'
import type { Chapter } from '@domain/model'

/**
 * Fills in the duration of chapters that do not know theirs yet.
 *
 * An <audio> element reads the metadata of a file served by our own protocol
 * without decoding the track — which is why measuring a fourteen-minute chapter
 * costs nothing, and why no audio parser is needed anywhere in this project.
 */
export const useDurations = (
  chapters: Chapter[],
  setChapter: (key: string, changes: Partial<Chapter>) => void
): void => {
  useEffect(() => {
    const pending = chapters.filter((c) => c.duration === null)
    if (pending.length === 0) return

    const elements: HTMLAudioElement[] = []
    for (const chapter of pending) {
      const element = new Audio(window.telmi.fileUrl(chapter.audio.id))
      element.preload = 'metadata'
      element.addEventListener(
        'loadedmetadata',
        () => setChapter(chapter.key, { duration: Number.isFinite(element.duration) ? element.duration : 0 }),
        { once: true }
      )
      // An unreadable file gets a duration of 0 rather than blocking the form.
      element.addEventListener('error', () => setChapter(chapter.key, { duration: 0 }), { once: true })
      elements.push(element)
    }
    return () => {
      for (const element of elements) element.src = ''
    }
  }, [chapters, setChapter])
}
