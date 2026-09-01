import { useCallback, useEffect, useState } from 'react'
import type { KnownStores } from '@domain/directory'
import type { AppError } from '@domain/errors'
import { byLanguage } from '@domain/rules/directory'
import ErrorBanner from '../presentation/ErrorBanner'

/**
 * Finding a store.
 *
 * This screen exists for a measured reason: the English and Chinese stores have
 * been alive for a year and no user has ever seen them, because their address is
 * buried in a wiki page. A store nobody can find receives no contribution.
 */
function StoresScreen(): React.JSX.Element {
  const [known, setKnown] = useState<KnownStores | null>(null)
  const [error, setError] = useState<AppError | null>(null)

  const refresh = useCallback(() => {
    void window.telmi.stores.known().then((answer) => {
      if (answer.ok) setKnown(answer.value)
      else {
        setError(answer.error)
        setKnown({ listings: [], chosen: '' })
      }
    })
  }, [])

  useEffect(refresh, [refresh])

  const choose = (repo: string): void => {
    void window.telmi.stores.choose(repo).then((answer) => {
      if (!answer.ok) setError(answer.error)
      refresh()
    })
  }

  return (
    <section>
      <h2>
        Découvrir {known !== null && <span className="count">{known.listings.length}</span>}
      </h2>
      <p className="hint">
        Les stores connus. Celui que tu choisis ici est celui où partiront tes propositions, et
        celui que tu modères si tu en as les droits.{' '}
        <button type="button" className="link" onClick={refresh}>
          rafraîchir
        </button>
      </p>

      {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}
      {known === null && <p className="hint">Lecture de l’annuaire…</p>}

      {byLanguage(known?.listings ?? []).map((group) => (
        <div key={group.language || 'autres'} className="langue">
          <h3>{group.language === '' ? 'Sans langue déclarée' : group.language.toUpperCase()}</h3>
          <ul className="store-list">
            {group.stores.map((store) => (
              <li key={store.repo} className={store.repo === known?.chosen ? 'store choisi' : 'store'}>
                <div className="store-head">
                  <span className="store-nom">{store.name}</span>
                  {store.repo === known?.chosen ? (
                    <span className="badge-etat ok">choisi</span>
                  ) : (
                    <button type="button" onClick={() => choose(store.repo)}>
                      Choisir
                    </button>
                  )}
                </div>
                {store.description !== '' && <p className="hint">{store.description}</p>}
                <p className="quiet">
                  <code>{store.repo}</code>
                </p>
                <p className="quiet">
                  Pour l’ajouter dans Telmi-Sync : <code>{store.indexUrl}</code>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {known !== null && known.listings.length > 0 && (
        <p className="hint">
          Un store manque ? L’annuaire est un fichier :{' '}
          <code>annuaire/stores.json</code> dans le dépôt de Telmi Store. L’y ajouter est une
          proposition d’une ligne — et il apparaîtra chez tout le monde sans nouvelle version de
          l’application.
        </p>
      )}
    </section>
  )
}

export default StoresScreen
