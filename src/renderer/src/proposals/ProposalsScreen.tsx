import ErrorBanner from '../presentation/ErrorBanner'
import { STATE_TEXT } from './etatsEnFrancais'
import { useProposals } from './useProposals'

interface Props {
  /** Null when nobody is signed in: there is nothing to follow then. */
  login: string | null
}

const jour = (iso: string): string => {
  if (iso === '') return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

/**
 * Following one's own proposals.
 *
 * The point of this screen is that a contributor never has to open GitHub to
 * learn what happened: the state, and what was said, are here.
 */
function ProposalsScreen({ login }: Props): React.JSX.Element {
  const following = useProposals(login !== null)

  if (login === null) {
    return (
      <section>
        <h2>Mes propositions</h2>
        <p className="hint">Connecte-toi à GitHub pour suivre les histoires que tu as proposées.</p>
      </section>
    )
  }

  return (
    <section>
      <h2>
        Mes propositions{' '}
        {following.proposals !== null && <span className="count">{following.proposals.length}</span>}
      </h2>
      <p className="hint">
        Ce qu’il advient des histoires que tu as proposées. Tu n’as pas besoin d’ouvrir GitHub :
        l’état et les messages sont ici.{' '}
        <button type="button" className="link" onClick={following.refresh}>
          rafraîchir
        </button>
      </p>

      {following.error && <ErrorBanner error={following.error} onDismiss={following.dismissError} />}

      {following.proposals === null && <p className="hint">Lecture des propositions…</p>}

      {following.proposals !== null && following.proposals.length === 0 && !following.error && (
        <p className="hint">
          Tu n’as encore rien proposé. Dépose une histoire dans l’onglet précédent, puis publie-la.
        </p>
      )}

      <ul className="proposals">
        {(following.proposals ?? []).map((proposal) => {
          const state = STATE_TEXT[proposal.state]
          return (
            <li key={`${proposal.storeRepo}#${proposal.number}`} className="proposal">
              <div className="proposal-head">
                <span className={`badge-etat ${state.tone}`}>{state.label}</span>
                <span className="proposal-title">{proposal.title}</span>
                <span className="quiet">
                  n° {proposal.number} · {jour(proposal.at)}
                </span>
              </div>

              <p className="hint">{state.hint}</p>

              {proposal.comments.length > 0 && (
                <ul className="proposal-comments">
                  {proposal.comments.map((comment, index) => (
                    <li key={index}>
                      <span className="account-login">@{comment.author}</span>
                      <span className="quiet">{jour(comment.at)}</span>
                      <p>{comment.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              {/* Only where a correction was actually asked for: telling someone
                  « rien à faire de ton côté » and then how to correct contradicts
                  itself. */}
              {proposal.state === 'changes-requested' && (
                <p className="hint">
                  Pour corriger : redépose la même histoire avec le même titre, et republie.{' '}
                  <strong>La proposition sera mise à jour</strong>, pas dupliquée.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ProposalsScreen
