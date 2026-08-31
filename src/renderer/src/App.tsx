import { useEffect, useState } from 'react'
import type { HistoireLocale } from '@shared/types'
import type { ErreurIpc } from '@shared/ipc'

const formaterPoids = (octets: number): string =>
  octets >= 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`

/**
 * Premiere tranche : la bibliotheque locale de Telmi-Sync, qui est l'entree de
 * tout le reste — c'est ici qu'on choisira l'histoire a proposer a un store.
 */
function App(): React.JSX.Element {
  const [histoires, setHistoires] = useState<HistoireLocale[] | null>(null)
  const [erreur, setErreur] = useState<ErreurIpc | null>(null)

  useEffect(() => {
    void window.telmi.bibliotheque.lister().then((r) => {
      if (r.ok) setHistoires(r.valeur)
      else setErreur(r.erreur)
    })
  }, [])

  return (
    <main>
      <header>
        <h1>Telmi Store</h1>
        <p className="sous-titre">
          Proposer et moderer des histoires pour une conteuse Telmi, sans jamais voir git.
        </p>
      </header>

      {erreur && (
        <div className="erreur" role="alert">
          <strong>{erreur.message}</strong>
          {erreur.details && <code>{erreur.details}</code>}
        </div>
      )}

      {!erreur && histoires === null && <p className="attente">Lecture de la bibliotheque…</p>}

      {histoires !== null && (
        <section>
          <h2>
            Bibliotheque locale <span className="compte">{histoires.length}</span>
          </h2>
          <p className="aide">
            Lue depuis <code>~/.telmi/stories</code>, en seule lecture. Une histoire dont la
            version vaut 0 ne recevra jamais de mise a jour : c&apos;est le premier point a
            corriger avant de la proposer.
          </p>
          <ul className="liste">
            {histoires.map((h) => (
              <li key={h.dossier}>
                <div className="ligne">
                  <span className="titre">{h.titre}</span>
                  <span className="meta">{h.age}+</span>
                  <span className="meta">{h.categorie || '—'}</span>
                  <span className="chiffre">{formaterPoids(h.poids)}</span>
                  <span className="chiffre">{h.nbFichiers} fich.</span>
                  <span className={h.version >= 1 ? 'jeton ok' : 'jeton alerte'}>
                    v{h.version}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

export default App
