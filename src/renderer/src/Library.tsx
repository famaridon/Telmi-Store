import { useEffect, useState } from 'react'
import type { AppError } from '@domain/errors'
import type { LocalStory } from '@domain/model'
import { formatBytes } from './presentation/format'
import ErrorBanner from './presentation/ErrorBanner'

/**
 * Secondary path: submit a story Telmi-Sync has already built. Read-only —
 * this application never writes into ~/.telmi.
 */
function Library(): React.JSX.Element {
  const [stories, setStories] = useState<LocalStory[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  useEffect(() => {
    void window.telmi.library.list().then((answer) => {
      if (answer.ok) setStories(answer.value)
      else setError(answer.error)
    })
  }, [])

  return (
    <section>
      <h2>
        Bibliothèque locale {stories && <span className="count">{stories.length}</span>}
      </h2>
      <p className="hint">
        Lue depuis <code>~/.telmi/stories</code>, en seule lecture. Une histoire dont la
        version vaut 0 ne recevra jamais de mise à jour : c’est à corriger avant de la
        proposer.
      </p>

      {error && <ErrorBanner error={error} />}

      {!error && stories === null && <p className="hint">Lecture de la bibliothèque…</p>}

      {stories !== null && (
        <ul className="story-list">
          {stories.map((story) => (
            <li key={story.directory}>
              <div className="story-row">
                <span className="story-title">{story.title}</span>
                <span className="story-meta">{story.minAge}+</span>
                <span className="story-meta">{story.category || '—'}</span>
                <span className="figure">{formatBytes(story.bytes)}</span>
                <span className="figure">{story.fileCount} fich.</span>
                <span className={story.version >= 1 ? 'badge ok' : 'badge warn'}>v{story.version}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Library
