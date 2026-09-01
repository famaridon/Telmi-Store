import ErrorBanner from '../presentation/ErrorBanner'
import DeviceFlowSteps from './DeviceFlowSteps'
import type { Account } from './useAccount'

interface Props {
  account: Account
  onExplore: () => void
}

/**
 * The landing screen when nobody is signed in.
 *
 * It exists to answer, in this order, the questions a parent or a teacher
 * actually asks — starting with the one that would otherwise stop them cold:
 * why does sharing a story require a GitHub account?
 */
function Onboarding({ account, onExplore }: Props): React.JSX.Element {
  const waiting = account.state.step === 'waiting' ? account.state.code : null
  const starting = account.state.step === 'starting'

  return (
    <main className="onboarding">
      <header className="onboarding-head">
        <h1>Telmi Store</h1>
        <p className="onboarding-claim">
          Dix histoires que les enfants réclament valent mieux que cinq cents qu’ils zappent.
        </p>
      </header>

      {account.error && <ErrorBanner error={account.error} onDismiss={account.dismissError} />}

      {/* Hidden while waiting: two sequences both numbered 1-2-3, stacked, read
          as one confusing list — and at that point the code is the only thing
          that matters. */}
      {waiting === null && (
      <section className="onboarding-how">
        <h2>Comment ça marche</h2>
        <ol className="steps">
          <li>
            <b>Tu déposes</b>
            <span>
              Tes mp3, une image, un titre par piste. L’application fabrique le pack pour la
              conteuse — tu n’as rien à installer d’autre.
            </span>
          </li>
          <li>
            <b>Quelqu’un écoute</b>
            <span>
              Une personne du store écoute ton histoire avant qu’elle y figure, et peut la
              refuser. C’est ce qui fait la différence entre un store et un dépotoir.
            </span>
          </li>
          <li>
            <b>Elle arrive dans les conteuses</b>
            <span>
              Ton histoire apparaît dans Telmi-Sync, chez tous ceux qui ont ajouté ce store.
            </span>
          </li>
        </ol>
      </section>
      )}

      <section className="onboarding-action">
        {waiting !== null ? (
          <DeviceFlowSteps code={waiting} onOpen={account.openVerification} onCancel={account.cancel} />
        ) : (
          <>
            <button type="button" className="primary big" disabled={starting} onClick={account.signIn}>
              {starting ? 'Demande d’un code à GitHub…' : 'Se connecter à GitHub'}
            </button>
            <p className="quiet">
              Pas de mot de passe à taper ici : GitHub te donnera un code à quatre lettres.
            </p>
            <button type="button" className="link" onClick={onExplore}>
              découvrir sans compte
            </button>
          </>
        )}
      </section>
      {waiting === null && (
      <section className="onboarding-why">
        <h2>Pourquoi un compte GitHub&nbsp;?</h2>
        <p>
          Un store Telmi <strong>est</strong> un dépôt GitHub public : c’est ce qui rend chaque
          ajout traçable, discutable et réversible, et ce qui permet à quelqu’un de relire ta
          proposition avant publication. Ton compte sert à signer ce que tu proposes.
        </p>
        <p>
          Tu n’auras pas à apprendre GitHub : l’application s’en occupe. Créer un compte est
          gratuit et prend deux minutes.
        </p>

        <dl className="promises">
          <div>
            <dt>Ce que l’application ne voit jamais</dt>
            <dd>
              Ton mot de passe. Tu le saisis sur le site de GitHub, dans ton navigateur — jamais
              ici.
            </dd>
          </div>
          <div>
            <dt>Ce qu’elle demande</dt>
            <dd>
              Une seule autorisation, sur les <strong>dépôts publics</strong>. De quoi publier une
              histoire et ouvrir une proposition. Rien sur tes dépôts privés.
            </dd>
          </div>
          <div>
            <dt>Ce que tu gardes</dt>
            <dd>
              Tes histoires restent hébergées chez toi, sur ton compte. Le store n’en garde que
              l’adresse, et tu peux les retirer.
            </dd>
          </div>
        </dl>
      </section>
      )}
    </main>
  )
}

export default Onboarding
