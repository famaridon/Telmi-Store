import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Chapter, PickedFile, RightsStatus, Submission } from '@shared/types'
import type { IpcError } from '@shared/ipc'

export const EMPTY_SUBMISSION: Submission = {
  title: '',
  minAge: 3,
  category: '',
  language: 'fr',
  description: '',
  question: 'Quelle histoire veux-tu écouter ?',
  cover: null,
  chapters: [],
  rights: { status: '', source: '', declaredBy: '' }
}

/** The five rights statuses, each with the sentence that explains it. */
export const RIGHTS_STATUSES: readonly { value: RightsStatus; label: string; hint: string }[] = [
  { value: 'own-work', label: "J'en suis l'auteur", hint: "Tu as enregistré l'audio et tu détiens les images." },
  { value: 'public-domain', label: 'Domaine public', hint: "L'œuvre n'est plus protégée. Indique où tu l'as trouvée." },
  { value: 'cc-by', label: 'Creative Commons BY', hint: "Réutilisable avec attribution. Indique l'auteur et la source." },
  { value: 'cc-by-sa', label: 'Creative Commons BY-SA', hint: 'Comme BY, avec partage aux mêmes conditions.' },
  { value: 'written-permission', label: "J'ai une autorisation écrite", hint: "Tu as l'accord du titulaire des droits." }
]

/** 2 GiB: the size limit of a file attached to a GitHub release. */
export const BYTES_LIMIT = 2 * 1024 ** 3

/** Readable title from a file name: "03 - Le Loup.mp3" -> "Le Loup". */
export const titleFromFilename = (name: string): string =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/^[\s\d]+[-_.)\]]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const formatBytes = (b: number): string =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} Go`
    : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(b / 1024))} Ko`

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** Something that must be fixed before the pack can be built. */
export interface Blocker {
  field: string
  message: string
}

export interface SubmissionState {
  submission: Submission
  updateField: <K extends keyof Submission>(field: K, value: Submission[K]) => void
  updateRights: (field: keyof Submission['rights'], value: string) => void
  addChapters: (files: PickedFile[]) => void
  updateChapter: (key: string, changes: Partial<Chapter>) => void
  removeChapter: (key: string) => void
  moveChapter: (key: string, direction: -1 | 1) => void
  error: IpcError | null
  setError: (e: IpcError | null) => void
  blockers: Blocker[]
  warnings: string[]
  totalBytes: number
  totalDuration: number | null
  ready: boolean
}

let counter = 0
const nextKey = (): string => `c${++counter}`

export const useSubmission = (): SubmissionState => {
  const [submission, setSubmission] = useState<Submission>(EMPTY_SUBMISSION)
  const [error, setError] = useState<IpcError | null>(null)

  const updateField = useCallback(<K extends keyof Submission>(field: K, value: Submission[K]) => {
    setSubmission((s) => ({ ...s, [field]: value }))
  }, [])

  const updateRights = useCallback((field: keyof Submission['rights'], value: string) => {
    setSubmission((s) => ({ ...s, rights: { ...s.rights, [field]: value } }))
  }, [])

  const addChapters = useCallback((files: PickedFile[]) => {
    setSubmission((s) => ({
      ...s,
      chapters: [
        ...s.chapters,
        ...files.map((audio) => ({
          key: nextKey(),
          title: titleFromFilename(audio.name),
          audio,
          duration: null,
          image: null
        }))
      ]
    }))
  }, [])

  const updateChapter = useCallback((key: string, changes: Partial<Chapter>) => {
    setSubmission((s) => ({
      ...s,
      chapters: s.chapters.map((c) => (c.key === key ? { ...c, ...changes } : c))
    }))
  }, [])

  const removeChapter = useCallback((key: string) => {
    setSubmission((s) => ({ ...s, chapters: s.chapters.filter((c) => c.key !== key) }))
  }, [])

  const moveChapter = useCallback((key: string, direction: -1 | 1) => {
    setSubmission((s) => {
      const i = s.chapters.findIndex((c) => c.key === key)
      const j = i + direction
      if (i < 0 || j < 0 || j >= s.chapters.length) return s
      const list = [...s.chapters]
      const held = list[i]!
      list[i] = list[j]!
      list[j] = held
      return { ...s, chapters: list }
    })
  }, [])

  /**
   * Duration comes from an <audio> element: the file is served by our own
   * protocol, and the browser reads its metadata without decoding the track.
   */
  useEffect(() => {
    const toMeasure = submission.chapters.filter((c) => c.duration === null)
    if (toMeasure.length === 0) return

    const elements: HTMLAudioElement[] = []
    for (const chapter of toMeasure) {
      const element = new Audio(window.telmi.fileUrl(chapter.audio.id))
      element.preload = 'metadata'
      element.addEventListener(
        'loadedmetadata',
        () => updateChapter(chapter.key, { duration: Number.isFinite(element.duration) ? element.duration : 0 }),
        { once: true }
      )
      element.addEventListener('error', () => updateChapter(chapter.key, { duration: 0 }), { once: true })
      elements.push(element)
    }
    return () => {
      for (const element of elements) element.src = ''
    }
  }, [submission.chapters, updateChapter])

  const totalBytes = useMemo(
    () =>
      submission.chapters.reduce((t, c) => t + c.audio.bytes + (c.image?.bytes ?? 0), 0) +
      (submission.cover?.bytes ?? 0),
    [submission.chapters, submission.cover]
  )

  const totalDuration = useMemo(() => {
    if (submission.chapters.length === 0) return null
    if (submission.chapters.some((c) => c.duration === null)) return null
    return submission.chapters.reduce((t, c) => t + (c.duration ?? 0), 0)
  }, [submission.chapters])

  const blockers = useMemo<Blocker[]>(() => {
    const list: Blocker[] = []
    if (submission.title.trim() === '') list.push({ field: 'title', message: "L'histoire n'a pas de titre." })
    if (submission.cover === null) list.push({ field: 'cover', message: 'Il manque une image de couverture.' })
    if (submission.chapters.length === 0) list.push({ field: 'chapters', message: 'Ajoute au moins un fichier audio.' })

    const untitled = submission.chapters.filter((c) => c.title.trim() === '').length
    if (untitled > 0) {
      list.push({
        field: 'chapters',
        message: untitled === 1 ? 'Une piste est sans titre.' : `${untitled} pistes sont sans titre.`
      })
    }

    if (submission.rights.status === '') list.push({ field: 'rights', message: "Précise l'origine des droits." })
    if (submission.rights.source.trim() === '') list.push({ field: 'rights', message: 'Indique la source du contenu.' })
    if (submission.rights.declaredBy.trim() === '') list.push({ field: 'rights', message: 'Indique qui déclare ces droits.' })

    if (totalBytes > BYTES_LIMIT) {
      list.push({
        field: 'chapters',
        message: `Le pack dépasse 2 Go (${formatBytes(totalBytes)}) : aucune release ne l'accepterait. Retire des pistes.`
      })
    }
    return list
  }, [submission, totalBytes])

  const warnings = useMemo(() => {
    const list: string[] = []

    const titles = submission.chapters.map((c) => c.title.trim().toLowerCase()).filter((t) => t !== '')
    if (new Set(titles).size !== titles.length) {
      list.push('Deux pistes portent le même titre : elles seront annoncées à l’identique.')
    }

    const withoutImage = submission.chapters.filter((c) => c.image === null).length
    if (withoutImage > 0 && submission.cover !== null) {
      list.push(
        withoutImage === submission.chapters.length
          ? 'Aucune piste n’a d’image : la couverture sera utilisée pour toutes.'
          : `${withoutImage} piste(s) sans image : la couverture sera utilisée.`
      )
    }

    if (totalBytes > 500 * 1024 ** 2 && totalBytes <= BYTES_LIMIT) {
      list.push(`${formatBytes(totalBytes)} à envoyer : prévois plusieurs minutes de publication.`)
    }

    if (submission.description.trim() === '') {
      list.push('Sans description, le modérateur aura peu d’éléments pour juger.')
    }
    return list
  }, [submission, totalBytes])

  return {
    submission,
    updateField,
    updateRights,
    addChapters,
    updateChapter,
    removeChapter,
    moveChapter,
    error,
    setError,
    blockers,
    warnings,
    totalBytes,
    totalDuration,
    ready: blockers.length === 0
  }
}
