import type { Submission } from '@domain/model'
import type { Voices } from '../voice/useVoices'
import ErrorBanner from '../presentation/ErrorBanner'
import { formatBytes } from '../presentation/format'
import { useBuildPack } from './useBuildPack'

interface Props {
  submission: Submission
  /** Stable identity of the story, kept across versions. */
  uuid: string
  ready: boolean
  voices: Voices
}

/** The last step of the screen: turning the form into a pack. */
function BuildPanel({ submission, uuid, ready, voices }: Props): React.JSX.Element {
  const build = useBuildPack()
  const { state } = build

  return (
    <div className="build">
      {build.error && <ErrorBanner error={build.error} onDismiss={build.dismissError} />}

      {state.step === 'idle' && (
        <>
          <button
            type="button"
            className="primary big"
            disabled={!ready}
            onClick={() => build.build(submission, uuid, voices.files(), voices.complete)}
          >
            Fabriquer le pack
          </button>
          {ready && (
            <p className="hint">
              {voices.complete
                ? 'Les titres seront dits à voix haute, avec ta voix, et lisibles sur les images.'
                : 'Les titres seront incrustés dans les images. La conteuse ne les annoncera pas — enregistre-les à l’étape précédente si tu veux qu’elle le fasse.'}
            </p>
          )}
        </>
      )}

      {state.step === 'drawing' && (
        <p className="build-progress">
          <span className="pulse" aria-hidden="true"></span>
          Fabrication des images… {state.done} / {state.total}
        </p>
      )}

      {state.step === 'writing' && (
        <p className="build-progress">
          <span className="pulse" aria-hidden="true"></span>
          Écriture de l’archive et des pistes audio…
        </p>
      )}

      {state.step === 'done' && (
        <div className="build-done">
          <h3>Le pack est prêt</h3>
          <dl className="build-facts">
            <div>
              <dt>Poids</dt>
              <dd>{formatBytes(state.pack.bytes)}</dd>
            </div>
            <div>
              <dt>Fichiers</dt>
              <dd>{state.pack.fileCount}</dd>
            </div>
            <div>
              <dt>Empreinte</dt>
              <dd className="sha">{state.pack.sha256}</dd>
            </div>
          </dl>
          <p className="hint">
            Tu peux déjà l’installer dans Telmi-Sync pour l’écouter. La publication sur un store
            est l’étape d’après.
          </p>
          <div className="build-actions">
            <button type="button" onClick={build.reveal}>
              Montrer le fichier
            </button>
            <button type="button" className="link" onClick={build.reset}>
              fabriquer à nouveau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuildPanel
