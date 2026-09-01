import type { Submission } from '@domain/model'
import type { BuiltPack } from '@domain/pack'
import { entryToJson } from '@domain/rules/entry'
import ErrorBanner from '../presentation/ErrorBanner'
import { formatBytes } from '../presentation/format'
import ProposePanel from '../propose/ProposePanel'
import { usePublish } from './usePublish'

interface Props {
  submission: Submission
  pack: BuiltPack
  uuid: string
  /** The signed-in login, or null when nobody is. */
  login: string | null
}

/**
 * Publishing the pack, and showing the entry it produced.
 *
 * The pack goes into a repository the CONTRIBUTOR owns: the store will only ever
 * hold the two kilo-octets shown at the bottom of this panel. Saying so here is
 * the point — it is the least obvious and most reassuring part of the model.
 */
function PublishPanel({ submission, pack, uuid, login }: Props): React.JSX.Element {
  const publish = usePublish()
  const { state } = publish

  if (login === null) {
    return (
      <div className="publish">
        <p className="hint">
          Connecte-toi à GitHub pour publier ce pack. Il ira dans <strong>ton</strong> dépôt : le
          store n’en gardera que l’adresse.
        </p>
      </div>
    )
  }

  return (
    <div className="publish">
      {publish.error && <ErrorBanner error={publish.error} onDismiss={publish.dismissError} />}

      {state.step === 'idle' && (
        <>
          <button
            type="button"
            className="primary big"
            onClick={() => publish.publish(submission, pack, uuid, login)}
          >
            Publier le pack
          </button>
          <p className="hint">
            Le pack sera envoyé dans un dépôt <strong>de ton compte</strong>, en pièce jointe d’une
            release. Le store ne recevra qu’une fiche de deux kilo-octets pointant vers lui — et
            tu pourras le retirer quand tu veux.
          </p>
        </>
      )}

      {state.step === 'sending' && (
        <div className="publish-progress">
          <p className="build-progress">
            <span className="pulse" aria-hidden="true"></span>
            Envoi du pack… {formatBytes(state.sent)}
            {state.total !== null && ` / ${formatBytes(state.total)}`}
          </p>
          {state.total !== null && state.total > 0 && (
            <div className="jauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((state.sent / state.total) * 100)}>
              <span style={{ width: `${Math.min(100, Math.round((state.sent / state.total) * 100))}%` }} />
            </div>
          )}
          <p className="hint">
            Plusieurs minutes pour un gros pack. Si ça échoue, relance : la publication reprend
            sans créer de doublon.
          </p>
        </div>
      )}

      {state.step === 'done' && (
        <div className="build-done">
          <h3>Le pack est publié</h3>
          <dl className="build-facts">
            <div>
              <dt>Dépôt</dt>
              <dd>{state.published.repo}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{state.published.tag}</dd>
            </div>
          </dl>

          <p className="hint">
            Adresse publique du pack : <code>{state.published.url}</code>
          </p>

          <h3>La fiche que le store recevra</h3>
          <p className="hint">
            Deux kilo-octets, relisibles en trente secondes. C’est tout ce que le store gardera
            de ton histoire — proposer cette fiche est l’étape suivante.
          </p>
          <pre className="fiche">{JSON.stringify(entryToJson(state.published.entry), null, 2)}</pre>

          <ProposePanel
            entry={state.published.entry}
            packUrl={state.published.url}
            coverId={submission.cover?.id ?? ''}
          />

          <div className="build-actions">
            <button type="button" className="link" onClick={publish.reset}>
              publier à nouveau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PublishPanel
