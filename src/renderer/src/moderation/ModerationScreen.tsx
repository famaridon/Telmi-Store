import ErrorBanner from '../presentation/ErrorBanner'
import ProposalCard from './ProposalCard'
import { useModeration } from './useModeration'

interface Props {
  login: string | null
}

/**
 * Answering proposals.
 *
 * The screen is built around refusing well, not around accepting: a store is
 * judged as much on what it turned down as on what it published.
 */
function ModerationScreen({ login }: Props): React.JSX.Element {
  const moderation = useModeration(login !== null)

  if (login === null) {
    return (
      <section>
        <h2>Modération</h2>
        <p className="hint">Connecte-toi à GitHub pour répondre aux propositions.</p>
      </section>
    )
  }

  return (
    <section>
      <h2>
        Modération{' '}
        {moderation.awaiting !== null && <span className="count">{moderation.awaiting.length}</span>}
      </h2>
      <p className="hint">
        Écoute, puis réponds. <strong>Refuser fait partie du travail</strong> : un store se juge
        autant sur ce qu’il a écarté que sur ce qu’il publie — et chaque motif ci-dessous
        pré-écrit son message.{' '}
        <button type="button" className="link" onClick={moderation.refresh}>
          rafraîchir
        </button>
      </p>

      {moderation.error && (
        <ErrorBanner error={moderation.error} onDismiss={moderation.dismissError} />
      )}

      {moderation.allowed === null && <p className="hint">Vérification de tes droits…</p>}

      {moderation.allowed === false && (
        <p className="hint">
          Tu n’as pas les droits d’écriture sur ce store, donc rien à modérer ici. C’est la
          personne qui le maintient qui les accorde.
        </p>
      )}

      {moderation.allowed === true && moderation.awaiting === null && (
        <p className="hint">Lecture des propositions…</p>
      )}

      {moderation.allowed === true && moderation.awaiting?.length === 0 && (
        <p className="hint">Aucune proposition n’attend de réponse. Boîte vide, bon signe.</p>
      )}

      <ul className="proposals">
        {(moderation.awaiting ?? []).map((proposal) => (
          <ProposalCard key={proposal.number} proposal={proposal} moderation={moderation} />
        ))}
      </ul>
    </section>
  )
}

export default ModerationScreen
