import { useState } from 'react'
import ErrorBanner from '../presentation/ErrorBanner'
import { useAccount } from './useAccount'

/**
 * Where the Device Flow becomes visible.
 *
 * The code is deliberately the biggest thing on screen while we wait: it is the
 * only thing the contributor has to do something with.
 */
function AccountPanel(): React.JSX.Element {
  const account = useAccount()
  const [copied, setCopied] = useState(false)

  const copy = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Copying is a convenience; the code stays readable on screen.
    }
  }

  return (
    <div className="account">
      {account.error && <ErrorBanner error={account.error} onDismiss={account.dismissError} />}

      {account.state.step === 'loading' && <span className="account-quiet">…</span>}

      {account.state.step === 'anonymous' && (
        <button type="button" onClick={account.signIn}>
          Se connecter à GitHub
        </button>
      )}

      {account.state.step === 'starting' && (
        <span className="account-quiet">Demande d’un code à GitHub…</span>
      )}

      {account.state.step === 'waiting' && (
        <div className="device-flow">
          <p className="device-steps">
            <span className="device-step">1</span> Ouvre la page GitHub{' '}
            <span className="device-step">2</span> saisis ce code{' '}
            <span className="device-step">3</span> autorise l’application
          </p>

          <button
            type="button"
            className="device-code"
            title="Cliquer pour copier"
            onClick={() => void copy(account.state.step === 'waiting' ? account.state.code.userCode : '')}
          >
            {account.state.code.userCode}
          </button>
          <span className="account-quiet">{copied ? 'copié' : 'clique pour copier'}</span>

          <div className="device-actions">
            <button type="button" className="primary" onClick={account.openVerification}>
              Ouvrir github.com/login/device
            </button>
            <button type="button" className="link" onClick={account.cancel}>
              annuler
            </button>
          </div>

          <p className="account-quiet">
            J’attends que tu autorises. Rien à faire ici, cette page se mettra à jour toute
            seule.
          </p>
        </div>
      )}

      {account.state.step === 'signedIn' && (
        <div className="signed-in">
          <span className="account-login">@{account.state.session.identity.login}</span>
          {account.state.session.identity.name !== null && (
            <span className="account-quiet">{account.state.session.identity.name}</span>
          )}
          <button type="button" className="link" onClick={account.signOut}>
            se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountPanel
