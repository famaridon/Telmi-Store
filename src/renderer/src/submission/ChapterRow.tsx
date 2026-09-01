import type { Chapter } from '@domain/model'
import { formatBytes, formatDuration } from '../presentation/format'

interface Props {
  chapter: Chapter
  index: number
  count: number
  onChange: (changes: Partial<Chapter>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
  onPickImage: () => void
}

function ChapterRow({ chapter, index, count, onChange, onRemove, onMove, onPickImage }: Props): React.JSX.Element {
  const { title, audio, duration, image } = chapter

  return (
    <li className="chapter">
      <span className="chapter-index">{index + 1}</span>

      <div className="chapter-body">
        <input
          className={title.trim() === '' ? 'chapter-title missing' : 'chapter-title'}
          value={title}
          placeholder="Titre de la piste — il sera dit à voix haute"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <div className="chapter-meta">
          <span title={audio.name}>{audio.name}</span>
          {audio.from === 'url' && <span className="tag">URL</span>}
          <span className="figure">{formatDuration(duration)}</span>
          <span className="figure">{formatBytes(audio.bytes)}</span>
        </div>
        <audio controls preload="none" src={window.telmi.fileUrl(audio.id)} />
      </div>

      <div className="chapter-image">
        {image ? (
          <img src={window.telmi.fileUrl(image.id)} alt="" />
        ) : (
          <div className="no-image" title="La couverture sera utilisée">couverture</div>
        )}
        <button type="button" className="link" onClick={onPickImage}>
          {image ? 'changer' : 'image'}
        </button>
        {image && (
          <button type="button" className="link" onClick={() => onChange({ image: null })}>
            retirer
          </button>
        )}
      </div>

      <div className="chapter-actions">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} title="Monter">↑</button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} title="Descendre">↓</button>
        <button type="button" className="remove" onClick={onRemove} title="Retirer cette piste">✕</button>
      </div>
    </li>
  )
}

export default ChapterRow
