import { useState } from 'react'
import SubmissionScreen from './submission/SubmissionScreen'
import Library from './Library'
import AccountPanel from './account/AccountPanel'

type Tab = 'submit' | 'library'

function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('submit')

  return (
    <main>
      <header>
        <div className="app-title">
          <h1>Telmi Store</h1>
          <p className="tagline">
            Dix histoires que les enfants réclament valent mieux que cinq cents qu’ils zappent.
          </p>
        </div>
        <AccountPanel />
        <nav className="tabs">
          <button type="button" className={tab === 'submit' ? 'selected' : ''} onClick={() => setTab('submit')}>
            Déposer une histoire
          </button>
          <button type="button" className={tab === 'library' ? 'selected' : ''} onClick={() => setTab('library')}>
            Ma bibliothèque
          </button>
        </nav>
      </header>

      {tab === 'submit' ? <SubmissionScreen /> : <Library />}
    </main>
  )
}

export default App
