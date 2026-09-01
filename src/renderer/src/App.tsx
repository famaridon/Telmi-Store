import { useState } from 'react'
import SubmissionScreen from './submission/SubmissionScreen'
import Library from './Library'
import ProposalsScreen from './proposals/ProposalsScreen'
import ModerationScreen from './moderation/ModerationScreen'
import StoresScreen from './stores/StoresScreen'
import AccountPanel from './account/AccountPanel'
import Onboarding from './account/Onboarding'
import { useAccount } from './account/useAccount'

type Tab = 'submit' | 'proposals' | 'moderate' | 'stores' | 'library'

function App(): React.JSX.Element {
  const account = useAccount()
  const [tab, setTab] = useState<Tab>('submit')
  /**
   * Set by "découvrir sans compte". The onboarding is a doorway, not a wall: a
   * submission can be prepared without an account, only publishing needs one.
   */
  const [exploring, setExploring] = useState(false)

  const login = account.state.step === 'signedIn' ? account.state.identity.login : null

  // Restoring a kept token takes a moment; showing the onboarding meanwhile
  // would make it flash for someone who is in fact already signed in.
  if (account.state.step === 'loading') {
    return (
      <main className="splash">
        <p className="quiet">Telmi Store…</p>
      </main>
    )
  }

  if (account.state.step !== 'signedIn' && !exploring) {
    return <Onboarding account={account} onExplore={() => setExploring(true)} />
  }

  return (
    <main>
      <header>
        <div className="app-title">
          <h1>Telmi Store</h1>
          <p className="tagline">
            Dix histoires que les enfants réclament valent mieux que cinq cents qu’ils zappent.
          </p>
        </div>
        <AccountPanel account={account} />
      </header>

      {/* Onglets coiffant un panneau, comme le composant Tabs de Telmi-Sync :
          l'onglet sélectionné se raccorde visuellement au contenu. */}
      <nav className="tabs">
        <button type="button" className={tab === 'submit' ? 'selected' : ''} onClick={() => setTab('submit')}>
          Déposer une histoire
        </button>
        <button
          type="button"
          className={tab === 'proposals' ? 'selected' : ''}
          onClick={() => setTab('proposals')}
        >
          Mes propositions
        </button>
        <button
          type="button"
          className={tab === 'moderate' ? 'selected' : ''}
          onClick={() => setTab('moderate')}
        >
          Modération
        </button>
        <button
          type="button"
          className={tab === 'stores' ? 'selected' : ''}
          onClick={() => setTab('stores')}
        >
          Découvrir
        </button>
        <button type="button" className={tab === 'library' ? 'selected' : ''} onClick={() => setTab('library')}>
          Ma bibliothèque
        </button>
      </nav>

      <div className="panel">
        {tab === 'submit' && <SubmissionScreen login={login} />}
        {tab === 'proposals' && <ProposalsScreen login={login} />}
        {tab === 'moderate' && <ModerationScreen login={login} />}
        {tab === 'stores' && <StoresScreen />}
        {tab === 'library' && <Library />}
      </div>
    </main>
  )
}

export default App
