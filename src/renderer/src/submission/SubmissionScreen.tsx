import { useCallback, useState } from 'react'
import type { PickedFile } from '@domain/model'
import { RIGHTS_STATUSES } from '@domain/rules/submission'
import { describeBlocker, describeWarning, RIGHTS_TEXT } from '../presentation/messages'
import { formatBytes, formatDuration } from '../presentation/format'
import ErrorBanner from '../presentation/ErrorBanner'
import BuildPanel from '../build/BuildPanel'
import VoicePanel from '../voice/VoicePanel'
import { useVoices } from '../voice/useVoices'
import { useSubmission } from './useSubmission'
import UrlField from './UrlField'
import ChapterRow from './ChapterRow'

/**
 * The entry screen of the whole project. A parent or a teacher must be able to
 * get through it without a terminal or a text editor.
 */
interface Props {
  /** The signed-in login, or null when someone chose to look around first. */
  login: string | null
}

function SubmissionScreen({ login }: Props): React.JSX.Element {
  const form = useSubmission()
  const { submission, review } = form
  const voices = useVoices(submission)
  const [dragging, setDragging] = useState(false)

  const dropFiles = useCallback(
    async (files: FileList): Promise<void> => {
      const paths = Array.from(files).map((file) => window.telmi.files.pathOf(file))
      if (paths.length === 0) return
      const answer = await window.telmi.files.admit(paths, 'audio')
      if (answer.ok) form.addChapters(answer.value)
      else form.setError(answer.error)
    },
    [form]
  )

  const pickAudios = async (): Promise<void> => {
    const answer = await window.telmi.files.pickAudios()
    if (answer.ok) form.addChapters(answer.value)
    else form.setError(answer.error)
  }

  const pickImage = async (target: 'cover' | string): Promise<void> => {
    const answer = await window.telmi.files.pickImage()
    if (!answer.ok) return form.setError(answer.error)
    const image = answer.value[0]
    if (!image) return
    if (target === 'cover') form.setField('cover', image)
    else form.setChapter(target, { image })
  }

  const setCoverFromUrl = (files: PickedFile[]): void => {
    const image = files[0]
    if (image) form.setField('cover', image)
  }

  return (
    <div className="submission">
      {form.error && <ErrorBanner error={form.error} onDismiss={() => form.setError(null)} />}

      {/* ----------------------------------------------------------- chapters */}
      <section>
        <h2>Les pistes audio</h2>
        <p className="hint">
          Un seul mp3, ou un par chapitre. Le titre que tu donnes ici sera <strong>dit à voix
          haute</strong> par la conteuse : écris-le comme tu le prononcerais.
        </p>

        <div
          className={dragging ? 'dropzone dragging' : 'dropzone'}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void dropFiles(e.dataTransfer.files)
          }}
        >
          <p>Glisse tes mp3 ici</p>
          <button type="button" onClick={() => void pickAudios()}>Parcourir…</button>
          <UrlField
            kind="audio"
            placeholder="…ou colle l’adresse d’un mp3"
            onAdd={form.addChapters}
            onError={form.setError}
          />
        </div>

        {submission.chapters.length > 0 && (
          <ul className="chapters">
            {submission.chapters.map((chapter, index) => (
              <ChapterRow
                key={chapter.key}
                chapter={chapter}
                index={index}
                count={submission.chapters.length}
                onChange={(changes) => form.setChapter(chapter.key, changes)}
                onRemove={() => form.removeChapter(chapter.key)}
                onMove={(direction) => form.moveChapter(chapter.key, direction)}
                onPickImage={() => void pickImage(chapter.key)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------- story */}
      <section>
        <h2>L’histoire</h2>

        <div className="story-grid">
          <div className="fields">
            <label>
              Titre
              <input
                value={submission.title}
                placeholder="Les contes de la mère Pauline"
                onChange={(e) => form.setField('title', e.target.value)}
              />
            </label>

            <div className="field-row">
              <label>
                Âge minimum
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={submission.minAge}
                  onChange={(e) => form.setField('minAge', Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
                />
              </label>
              <label>
                Catégorie
                <input
                  value={submission.category}
                  placeholder="Contes"
                  onChange={(e) => form.setField('category', e.target.value)}
                />
              </label>
              <label>
                Langue
                <input
                  value={submission.language}
                  maxLength={5}
                  onChange={(e) => form.setField('language', e.target.value)}
                />
              </label>
            </div>

            <label>
              Question du menu
              <input value={submission.question} onChange={(e) => form.setField('question', e.target.value)} />
              <small>Dite avant la liste. Laisse vide pour aller droit au menu.</small>
            </label>

            <label>
              Description
              <textarea
                rows={5}
                value={submission.description}
                placeholder="De quoi parlent ces histoires, pour qui, par qui…"
                onChange={(e) => form.setField('description', e.target.value)}
              />
            </label>
          </div>

          <div className="cover">
            <h3>Couverture</h3>
            {submission.cover ? (
              <img src={window.telmi.fileUrl(submission.cover.id)} alt="" />
            ) : (
              <div className="no-image large">obligatoire</div>
            )}
            <button type="button" onClick={() => void pickImage('cover')}>
              {submission.cover ? 'Changer' : 'Choisir une image'}
            </button>
            <UrlField kind="image" placeholder="…ou une adresse" onAdd={setCoverFromUrl} onError={form.setError} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- rights */}
      <section>
        <h2>Les droits</h2>
        <p className="hint">
          Obligatoire, et lu par la personne qui modérera. Une histoire dont les droits ne
          permettent pas la rediffusion sera refusée.
        </p>

        <div className="rights">
          {RIGHTS_STATUSES.map((status) => (
            <label
              key={status}
              className={submission.rights.status === status ? 'choice selected' : 'choice'}
            >
              <input
                type="radio"
                name="rights"
                checked={submission.rights.status === status}
                onChange={() => form.setRights('status', status)}
              />
              <span className="choice-label">{RIGHTS_TEXT[status].label}</span>
              <span className="choice-hint">{RIGHTS_TEXT[status].hint}</span>
            </label>
          ))}
        </div>

        <div className="field-row">
          <label>
            Source
            <input
              value={submission.rights.source}
              placeholder="https://… ou « enregistré par moi-même »"
              onChange={(e) => form.setRights('source', e.target.value)}
            />
          </label>
          <label>
            Déclaré par
            <input
              value={submission.rights.declaredBy}
              placeholder="@pseudo"
              onChange={(e) => form.setRights('declaredBy', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* -------------------------------------------------------------- voice */}
      {submission.chapters.length > 0 && <VoicePanel voices={voices} />}

      {/* ------------------------------------------------------------ summary */}
      <section className="summary">
        <h2>Récapitulatif</h2>

        <div className="totals">
          <div><b>{submission.chapters.length}</b><span>piste(s)</span></div>
          <div><b>{formatDuration(review.totalDuration)}</b><span>durée totale</span></div>
          <div><b>{formatBytes(review.totalBytes)}</b><span>fichiers déposés</span></div>
        </div>

        {review.blockers.length > 0 && (
          <div className="blockers">
            <h3>Il reste à faire</h3>
            <ul>
              {review.blockers.map((blocker, i) => (
                <li key={i}>{describeBlocker(blocker)}</li>
              ))}
            </ul>
          </div>
        )}

        {review.warnings.length > 0 && (
          <div className="warnings">
            <h3>Bon à savoir</h3>
            <ul>
              {review.warnings.map((warning, i) => (
                <li key={i}>{describeWarning(warning)}</li>
              ))}
            </ul>
          </div>
        )}

        <BuildPanel
          submission={submission}
          uuid={form.uuid}
          ready={review.ready}
          voices={voices}
          login={login}
        />
      </section>
    </div>
  )
}

export default SubmissionScreen
