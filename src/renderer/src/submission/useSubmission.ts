import { useCallback, useMemo, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { Chapter, PickedFile, Submission } from '@domain/model'
import { EMPTY_SUBMISSION, chaptersFromFiles, moveInList, reviewSubmission, type SubmissionReview } from '@domain/rules/submission'
import { DEFAULT_QUESTION } from '../presentation/messages'
import { useDurations } from './useDurations'

/**
 * React plumbing, and nothing more.
 *
 * The question "is this story publishable" is answered by
 * `reviewSubmission` in the domain: this hook only holds the state and feeds it
 * in. That way the same reading can be applied by the moderation screen, and
 * tested without mounting a component.
 */
export interface SubmissionForm {
  submission: Submission
  review: SubmissionReview
  setField: <K extends keyof Submission>(field: K, value: Submission[K]) => void
  setRights: (field: keyof Submission['rights'], value: string) => void
  addChapters: (files: PickedFile[]) => void
  setChapter: (key: string, changes: Partial<Chapter>) => void
  removeChapter: (key: string) => void
  moveChapter: (key: string, direction: -1 | 1) => void
  error: AppError | null
  setError: (error: AppError | null) => void
}

let counter = 0
const nextKey = (): string => `c${++counter}`

export const useSubmission = (): SubmissionForm => {
  const [submission, setSubmission] = useState<Submission>({
    ...EMPTY_SUBMISSION,
    question: DEFAULT_QUESTION
  })
  const [error, setError] = useState<AppError | null>(null)

  const setField = useCallback(<K extends keyof Submission>(field: K, value: Submission[K]) => {
    setSubmission((s) => ({ ...s, [field]: value }))
  }, [])

  const setRights = useCallback((field: keyof Submission['rights'], value: string) => {
    setSubmission((s) => ({ ...s, rights: { ...s.rights, [field]: value } }))
  }, [])

  const addChapters = useCallback((files: PickedFile[]) => {
    setSubmission((s) => ({ ...s, chapters: [...s.chapters, ...chaptersFromFiles(files, nextKey)] }))
  }, [])

  const setChapter = useCallback((key: string, changes: Partial<Chapter>) => {
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
      const index = s.chapters.findIndex((c) => c.key === key)
      return index < 0 ? s : { ...s, chapters: moveInList(s.chapters, index, direction) }
    })
  }, [])

  useDurations(submission.chapters, setChapter)

  const review = useMemo(() => reviewSubmission(submission), [submission])

  return {
    submission,
    review,
    setField,
    setRights,
    addChapters,
    setChapter,
    removeChapter,
    moveChapter,
    error,
    setError
  }
}
