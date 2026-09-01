import type { StoreEntry } from '@domain/model'
import ErrorBanner from '../presentation/ErrorBanner'
import { usePropose } from './usePropose'

interface Props {
  entry: StoreEntry
  packUrl: string
  /** Id of the cover, from which the store thumbnail is drawn. */
  coverId: string
}

/**
 * The last step: handing the entry to a store.
 *
 * What leaves here is two files. Saying so plainly matters — a contributor is
 * about to open a pull request on a public repository, and should know exactly
 * what it contains.
 */
function ProposePanel({ entry, packUrl, coverId }: Props): React.JSX.Element {
  const propose = usePropose()
  const { state } = propose

  return (
    <div className="publish">
      {propose.error && <ErrorBanner error={propose.error} onDismiss={propose.dismissError} />}

      {state.step === 'idle' && (
        <>
          <button
            type="button"
            className="primary big"
            disabled={propose.store === null}
            onClick={() => propose.propose(entry, packUrl, coverId)}
          >
            Proposer au store
          </button>
          <p className="hint">
            {propose.store === null ? (
              'Recherche du store…'
            ) : (
              <>
                Deux fichiers partiront vers <code>{propose.store}</code> : la fiche ci-dessus et
                une vignette. Quelqu’un les relira, écoutera ton histoire, et pourra la refuser.
              </>
            )}
          </p>
        </>
      )}

      {state.step === 'sending' && (
        <p className="build-progress">
          <span className="pulse" aria-hidden="true"></span>
          Préparation de ta copie du store et envoi de la fiche…
        </p>
      )}

      {state.step === 'done' && (
        <div className="build-done">
          <h3>
            {state.proposed.updated ? 'Ta proposition est mise à jour' : 'Ta proposition est envoyée'}
          </h3>
          <p className="hint">
            {state.proposed.updated
              ? 'La proposition qui était déjà ouverte a été mise à jour : pas de doublon.'
              : 'Elle attend maintenant qu’une personne du store l’écoute. Tu peux suivre son état ici même.'}
          </p>
          <dl className="build-facts">
            <div>
              <dt>Proposition</dt>
              <dd>n° {state.proposed.number}</dd>
            </div>
            <div>
              <dt>Branche</dt>
              <dd>{state.proposed.branch}</dd>
            </div>
          </dl>
          <div className="build-actions">
            <button type="button" onClick={propose.open}>
              Voir la proposition sur GitHub
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProposePanel
