import { useCallback, useState } from 'react'
import type { PickedFile } from '@shared/types'
import { RIGHTS_STATUSES, formatBytes, formatDuration, useSubmission } from './useSubmission'
import UrlField from './UrlField'
import ChapterRow from './ChapterRow'

/**
 * The entry screen of the whole project. A parent or a teacher must be able to
 * get through it without a terminal or a text editor: that is the acceptance
 * criterion of stage 1.
 */
function SubmissionScreen(): React.JSX.Element {
  const s = useSubmission()
  const [dragging, setDragging] = useState(false)

  const dropFiles = useCallback(
    async (files: FileList): Promise<void> => {
      const paths = Array.from(files).map((f) => window.telmi.files.pathOf(f))
      if (paths.length === 0) return
      const r = await window.telmi.files.describe(paths, 'audio')
      if (r.ok) s.addChapters(r.value)
      else s.setError(r.error)
    },
    [s]
  )

  const pickAudios = async (): Promise<void> => {
    const r = await window.telmi.files.pickAudios()
    if (r.ok) s.addChapters(r.value)
    else s.setError(r.error)
  }

  const pickImage = async (target: 'cover' | string): Promise<void> => {
    const r = await window.telmi.files.pickImage()
    if (!r.ok) return s.setError(r.error)
    const image = r.value[0]
    if (!image) return
    if (target === 'cover') s.updateField('cover', image)
    else s.updateChapter(target, { image })
  }

  const addCoverFromUrl = (files: PickedFile[]): void => {
    const image = files[0]
    if (image) s.updateField('cover', image)
  }

  return (
    <div className="submission">
      {s.error && (
        <div className="error" role="alert">
          <strong>{s.error.message}</strong>
          {s.error.detail && <code>{s.error.detail}</code>}
          <button type="button" className="link" onClick={() => s.setError(null)}>fermer</button>
        </div>
      )}

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
            onAdd={s.addChapters}
            onError={s.setError}
          />
        </div>

        {s.submission.chapters.length > 0 && (
          <ul className="chapters">
            {s.submission.chapters.map((chapter, index) => (
              <ChapterRow
                key={chapter.key}
                chapter={chapter}
                index={index}
                count={s.submission.chapters.length}
                onChange={(changes) => s.updateChapter(chapter.key, changes)}
                onRemove={() => s.removeChapter(chapter.key)}
                onMove={(direction) => s.moveChapter(chapter.key, direction)}
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
                value={s.submission.title}
                placeholder="Les contes de la mère Pauline"
                onChange={(e) => s.updateField('title', e.target.value)}
              />
            </label>

            <div className="field-row">
              <label>
                Âge minimum
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={s.submission.minAge}
                  onChange={(e) => s.updateField('minAge', Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
                />
              </label>
              <label>
                Catégorie
                <input
                  value={s.submission.category}
                  placeholder="Contes"
                  onChange={(e) => s.updateField('category', e.target.value)}
                />
              </label>
              <label>
                Langue
                <input
                  value={s.submission.language}
                  maxLength={5}
                  onChange={(e) => s.updateField('language', e.target.value)}
                />
              </label>
            </div>

            <label>
              Question du menu
              <input
                value={s.submission.question}
                onChange={(e) => s.updateField('question', e.target.value)}
              />
              <small>Dite avant la liste. Laisse vide pour aller droit au menu.</small>
            </label>

            <label>
              Description
              <textarea
                rows={5}
                value={s.submission.description}
                placeholder="De quoi parlent ces histoires, pour qui, par qui…"
                onChange={(e) => s.updateField('description', e.target.value)}
              />
            </label>
          </div>

          <div className="cover">
            <h3>Couverture</h3>
            {s.submission.cover ? (
              <img src={window.telmi.fileUrl(s.submission.cover.id)} alt="" />
            ) : (
              <div className="no-image large">obligatoire</div>
            )}
            <button type="button" onClick={() => void pickImage('cover')}>
              {s.submission.cover ? 'Changer' : 'Choisir une image'}
            </button>
            <UrlField kind="image" placeholder="…ou une adresse" onAdd={addCoverFromUrl} onError={s.setError} />
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
              key={status.value}
              className={s.submission.rights.status === status.value ? 'choice selected' : 'choice'}
            >
              <input
                type="radio"
                name="rights"
                checked={s.submission.rights.status === status.value}
                onChange={() => s.updateRights('status', status.value)}
              />
              <span className="choice-label">{status.label}</span>
              <span className="choice-hint">{status.hint}</span>
            </label>
          ))}
        </div>

        <div className="field-row">
          <label>
            Source
            <input
              value={s.submission.rights.source}
              placeholder="https://… ou « enregistré par moi-même »"
              onChange={(e) => s.updateRights('source', e.target.value)}
            />
          </label>
          <label>
            Déclaré par
            <input
              value={s.submission.rights.declaredBy}
              placeholder="@pseudo"
              onChange={(e) => s.updateRights('declaredBy', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------------ summary */}
      <section className="summary">
        <h2>Récapitulatif</h2>

        <div className="totals">
          <div><b>{s.submission.chapters.length}</b><span>piste(s)</span></div>
          <div><b>{formatDuration(s.totalDuration)}</b><span>durée totale</span></div>
          <div><b>{formatBytes(s.totalBytes)}</b><span>fichiers déposés</span></div>
        </div>

        {s.blockers.length > 0 && (
          <div className="blockers">
            <h3>Il reste à faire</h3>
            <ul>
              {s.blockers.map((blocker, i) => (
                <li key={i}>{blocker.message}</li>
              ))}
            </ul>
          </div>
        )}

        {s.warnings.length > 0 && (
          <div className="warnings">
            <h3>Bon à savoir</h3>
            <ul>
              {s.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="primary" disabled={!s.ready}>
          Fabriquer le pack
        </button>
        {s.ready && (
          <p className="hint">
            La fabrication est l’étape suivante : ce bouton sera branché sur la génération du
            pack Telmi.
          </p>
        )}
      </section>
    </div>
  )
}

export default SubmissionScreen
