import type { Chapitre } from '@shared/types'
import { formaterDuree, formaterOctets } from './useDepot'

interface Props {
  chapitre: Chapitre
  rang: number
  total: number
  onMaj: (modif: Partial<Chapitre>) => void
  onRetirer: () => void
  onDeplacer: (sens: -1 | 1) => void
  onChoisirImage: () => void
}

function LigneChapitre({ chapitre, rang, total, onMaj, onRetirer, onDeplacer, onChoisirImage }: Props): React.JSX.Element {
  const { titre, audio, duree, image } = chapitre

  return (
    <li className="chapitre">
      <span className="rang">{rang + 1}</span>

      <div className="chapitre-corps">
        <input
          className={titre.trim() === '' ? 'titre-chapitre manquant' : 'titre-chapitre'}
          value={titre}
          placeholder="Titre du chapitre — il sera dit a voix haute"
          onChange={(e) => onMaj({ titre: e.target.value })}
        />
        <div className="chapitre-infos">
          <span title={audio.nom}>{audio.nom}</span>
          {audio.origine === 'url' && <span className="etiquette">URL</span>}
          <span className="chiffre">{formaterDuree(duree)}</span>
          <span className="chiffre">{formaterOctets(audio.octets)}</span>
        </div>
        <audio controls preload="none" src={window.telmi.urlFichier(audio.id)} />
      </div>

      <div className="chapitre-image">
        {image ? (
          <img src={window.telmi.urlFichier(image.id)} alt="" />
        ) : (
          <div className="image-absente" title="La couverture sera utilisee">couverture</div>
        )}
        <button type="button" className="lien" onClick={onChoisirImage}>
          {image ? 'changer' : 'image'}
        </button>
        {image && (
          <button type="button" className="lien" onClick={() => onMaj({ image: null })}>
            retirer
          </button>
        )}
      </div>

      <div className="chapitre-actions">
        <button type="button" disabled={rang === 0} onClick={() => onDeplacer(-1)} title="Monter">↑</button>
        <button type="button" disabled={rang === total - 1} onClick={() => onDeplacer(1)} title="Descendre">↓</button>
        <button type="button" className="retirer" onClick={onRetirer} title="Retirer ce chapitre">✕</button>
      </div>
    </li>
  )
}

export default LigneChapitre
