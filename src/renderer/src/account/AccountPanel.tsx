import ErrorBanner from '../presentation/ErrorBanner'
import DeviceFlowSteps from './DeviceFlowSteps'
import type { Account } from './useAccount'

interface Props {
  account: Account
}

/**
 * The account corner of the header, once the onboarding is behind us: who is
 * signed in, or a way back in for whoever chose to look around first.
 */
function AccountPanel({ account }: Props): React.JSX.Element {
  const { state } = account

  return (
    <div className="account">
      {account.error && <ErrorBanner error={account.error} onDismiss={account.dismissError} />}

      {state.step === 'signedIn' && (
        <div className="signed-in">
          <span className="account-login">@{state.identity.login}</span>
          {state.identity.name !== null && <span className="quiet">{state.identity.name}</span>}
          <button type="button" className="link" onClick={account.signOut}>
            se déconnecter
          </button>
        </div>
      )}

      {state.step === 'anonymous' && (
        <div className="signed-in">
          <span className="quiet">Non connecté — tu ne pourras pas publier</span>
          <button type="button" onClick={account.signIn}>
            Se connecter
          </button>
        </div>
      )}

      {state.step === 'starting' && <span className="quiet">Demande d’un code à GitHub…</span>}

      {state.step === 'waiting' && (
        <DeviceFlowSteps code={state.code} onOpen={account.openVerification} onCancel={account.cancel} />
      )}
    </div>
  )
}

export default AccountPanel
