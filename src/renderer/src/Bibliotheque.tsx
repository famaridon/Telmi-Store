import { useEffect, useState } from 'react'
import type { HistoireLocale } from '@shared/types'
import type { ErreurIpc } from '@shared/ipc'
import { formaterOctets } from './depot/useDepot'

/**
 * Voie secondaire : proposer une histoire deja fabriquee par Telmi-Sync.
 * Lue en seule lecture — cette application n'ecrit jamais dans ~/.telmi.
 */
function Bibliotheque(): React.JSX.Element {
  const [histoires, setHistoires] = useState<HistoireLocale[] | null>(null)
  const [erreur, setErreur] = useState<ErreurIpc | null>(null)

  useEffect(() => {
    void window.telmi.bibliotheque.lister().then((r) => {
      if (r.ok) setHistoires(r.valeur)
      else setErreur(r.erreur)
    })
  }, [])

  return (
    <section>
      <h2>
        Bibliotheque locale {histoires && <span className="compte">{histoires.length}</span>}
      </h2>
      <p className="aide">
        Lue depuis <code>~/.telmi/stories</code>, en seule lecture. Une histoire dont la
        version vaut 0 ne recevra jamais de mise a jour : c&apos;est a corriger avant de la
        proposer.
      </p>

      {erreur && (
        <div className="erreur" role="alert">
          <strong>{erreur.message}</strong>
          {erreur.details && <code>{erreur.details}</code>}
        </div>
      )}

      {!erreur && histoires === null && <p className="aide">Lecture de la bibliotheque…</p>}

      {histoires !== null && (
        <ul className="liste">
          {histoires.map((h) => (
            <li key={h.dossier}>
              <div className="ligne">
                <span className="titre">{h.titre}</span>
                <span className="meta">{h.age}+</span>
                <span className="meta">{h.categorie || '—'}</span>
                <span className="chiffre">{formaterOctets(h.poids)}</span>
                <span className="chiffre">{h.nbFichiers} fich.</span>
                <span className={h.version >= 1 ? 'jeton ok' : 'jeton alerte'}>v{h.version}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Bibliotheque
