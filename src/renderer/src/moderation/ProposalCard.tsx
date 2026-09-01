import { useState } from 'react'
import type { Awaiting } from '@domain/moderation'
import { RIGHTS_TEXT } from '../presentation/messages'
import { formatBytes } from '../presentation/format'
import { DECLINE_REASONS, acceptDraft } from './motifsDeRefus'
import type { Moderation } from './useModeration'
import PackPlayer from './PackPlayer'

interface Props {
  proposal: Awaiting
  moderation: Moderation
}

/** Files a proposal is supposed to touch, and nothing else. */
const EXPECTED = /^(histoires\/[a-z0-9-]+\.json|vignettes\/[a-z0-9-]+\.png)$/

function ProposalCard({ proposal, moderation }: Props): React.JSX.Element {
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null)
  const [comment, setComment] = useState('')
  const { entry } = proposal
  const rights = RIGHTS_TEXT[entry.rights.status]
  const unexpected = proposal.changed.filter((file) => !EXPECTED.test(file))
  const busy = moderation.busy === proposal.number
  const listening = moderation.listening?.number === proposal.number

  const startDecline = (draft: string): void => {
    setAnswering('decline')
    setComment(draft)
  }

  return (
    <li className="proposal">
      <div className="proposal-head">
        <span className="proposal-title">{entry.title || <em>(fiche illisible)</em>}</span>
        <span className="quiet">
          n° {proposal.number} · @{proposal.author}
        </span>
      </div>

      {/* Rights first: it is what a refusal most often turns on. */}
      <dl className="fiche-facts">
        <div className={entry.rights.status === 'own-work' ? 'droit' : 'droit tiers'}>
          <dt>Droits</dt>
          <dd>{rights.label}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{entry.rights.source || <em>non indiquée</em>}</dd>
        </div>
        <div>
          <dt>Âge</dt>
          <dd>{entry.minAge}+</dd>
        </div>
        <div>
          <dt>Catégorie</dt>
          <dd>{entry.category || '—'}</dd>
        </div>
        <div>
          <dt>Pack</dt>
          <dd>{formatBytes(entry.pack.bytes)}</dd>
        </div>
      </dl>

      {entry.description.trim() !== '' && <p className="hint">{entry.description}</p>}

      {unexpected.length > 0 && (
        <p className="player-alerte">
          ⚠ Cette proposition modifie des fichiers inattendus : {unexpected.join(', ')}. Une
          proposition normale n’en touche que deux.
        </p>
      )}

      {proposal.comments.length > 0 && (
        <ul className="proposal-comments">
          {proposal.comments.map((said, index) => (
            <li key={index}>
              <span className="account-login">@{said.author}</span>
              <p>{said.body}</p>
            </li>
          ))}
        </ul>
      )}

      {listening && moderation.listening !== null && (
        <PackPlayer pack={moderation.listening.pack} onClose={moderation.closePlayer} />
      )}

      {answering === null && (
        <div className="proposal-actions">
          <button type="button" disabled={busy} onClick={() => moderation.listen(proposal)}>
            {busy ? '…' : listening ? 'Réécouter' : '▶ Écouter'}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              setAnswering('accept')
              setComment(acceptDraft(entry))
            }}
          >
            Accepter
          </button>
          <span className="quiet">Refuser :</span>
          {DECLINE_REASONS.map((reason) => (
            <button
              key={reason.value}
              type="button"
              className="motif"
              disabled={busy}
              onClick={() => startDecline(reason.draft(entry))}
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}

      {answering !== null && (
        <div className="reponse">
          <label>
            {answering === 'accept' ? 'Message d’acceptation' : 'Pourquoi tu refuses'}
            <textarea rows={6} value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <div className="proposal-actions">
            <button
              type="button"
              className="primary"
              disabled={busy || comment.trim() === ''}
              onClick={() =>
                answering === 'accept'
                  ? moderation.accept(proposal.number, comment)
                  : moderation.decline(proposal.number, comment)
              }
            >
              {busy ? '…' : answering === 'accept' ? 'Accepter et fusionner' : 'Envoyer le refus'}
            </button>
            <button type="button" className="link" onClick={() => setAnswering(null)}>
              annuler
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default ProposalCard
