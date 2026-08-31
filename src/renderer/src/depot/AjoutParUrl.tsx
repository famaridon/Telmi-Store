import { useState } from 'react'
import type { GenreFichier } from '@shared/ipc'
import type { SourceFichier } from '@shared/types'

interface Props {
  genre: GenreFichier
  intitule: string
  onAjout: (sources: SourceFichier[]) => void
  onErreur: (e: { code: string; message: string; details?: string }) => void
}

/** Champ URL avec progression : le telechargement se fait dans le processus principal. */
function AjoutParUrl({ genre, intitule, onAjout, onErreur }: Props): React.JSX.Element {
  const [url, setUrl] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [progression, setProgression] = useState<string | null>(null)

  const envoyer = async (): Promise<void> => {
    const adresse = url.trim()
    if (adresse === '' || enCours) return

    setEnCours(true)
    setProgression('connexion…')
    const desabonner = window.telmi.sur('telechargement:progression', ({ recu, total }) => {
      setProgression(
        total === null
          ? `${(recu / 1024 ** 2).toFixed(1)} Mo recus`
          : `${Math.round((recu / total) * 100)} %`
      )
    })

    const r = await window.telmi.fichiers.telecharger(adresse, genre)
    desabonner()
    setEnCours(false)
    setProgression(null)

    if (r.ok) {
      onAjout([r.valeur])
      setUrl('')
    } else {
      onErreur(r.erreur)
    }
  }

  return (
    <div className="ajout-url">
      <input
        type="url"
        value={url}
        placeholder={intitule}
        disabled={enCours}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void envoyer()
        }}
      />
      <button type="button" disabled={enCours || url.trim() === ''} onClick={() => void envoyer()}>
        {enCours ? (progression ?? '…') : 'Recuperer'}
      </button>
    </div>
  )
}

export default AjoutParUrl
