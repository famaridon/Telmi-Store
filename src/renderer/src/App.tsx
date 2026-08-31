import { useState } from 'react'
import EcranDepot from './depot/EcranDepot'
import Bibliotheque from './Bibliotheque'

type Onglet = 'deposer' | 'bibliotheque'

function App(): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('deposer')

  return (
    <main>
      <header>
        <div className="titre-app">
          <h1>Telmi Store</h1>
          <p className="sous-titre">
            Dix histoires que les enfants reclament valent mieux que cinq cents qu&apos;ils zappent.
          </p>
        </div>
        <nav className="onglets">
          <button
            type="button"
            className={onglet === 'deposer' ? 'actif' : ''}
            onClick={() => setOnglet('deposer')}
          >
            Deposer une histoire
          </button>
          <button
            type="button"
            className={onglet === 'bibliotheque' ? 'actif' : ''}
            onClick={() => setOnglet('bibliotheque')}
          >
            Ma bibliotheque
          </button>
        </nav>
      </header>

      {onglet === 'deposer' ? <EcranDepot /> : <Bibliotheque />}
    </main>
  )
}

export default App
