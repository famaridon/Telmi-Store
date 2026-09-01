import type { PlayablePack } from '@domain/moderation'

interface Props {
  pack: PlayablePack
  onClose: () => void
}

/**
 * Listening to a proposal, without installing it.
 *
 * The pack is unzipped in a temporary folder and played through the same
 * capability a contributor uses for their own tracks. A moderator's library must
 * not fill up with proposals they are about to refuse.
 */
function PackPlayer({ pack, onClose }: Props): React.JSX.Element {
  return (
    <div className="player">
      <div className="player-head">
        <h4>{pack.title}</h4>
        <button type="button" className="link" onClick={onClose}>
          fermer
        </button>
      </div>

      {!pack.checksumMatches && (
        <p className="player-alerte">
          ⚠ Le pack téléchargé ne correspond pas à l’empreinte annoncée dans la fiche : il a été
          remplacé depuis la proposition. À refuser, ou à faire republier.
        </p>
      )}

      {pack.question !== '' && <p className="quiet">La conteuse demande : « {pack.question} »</p>}

      <ol className="player-chapters">
        {pack.chapters.map((chapter, index) => (
          <li key={chapter.audioId}>
            <span className="player-rang">{index + 1}</span>
            <span className="player-titre">{chapter.title}</span>
            <audio controls preload="none" src={window.telmi.fileUrl(chapter.audioId)} />
          </li>
        ))}
      </ol>
    </div>
  )
}

export default PackPlayer
