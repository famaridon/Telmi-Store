import { useCallback, useState } from 'react'
import type { SourceFichier } from '@shared/types'
import { STATUTS, formaterDuree, formaterOctets, useDepot } from './useDepot'
import AjoutParUrl from './AjoutParUrl'
import LigneChapitre from './LigneChapitre'

/**
 * L'ecran d'entree du projet. Un parent ou une institutrice doit pouvoir le
 * franchir sans terminal ni editeur de texte : c'est le critere d'acceptation
 * du lot 1.
 */
function EcranDepot(): React.JSX.Element {
  const d = useDepot()
  const [survol, setSurvol] = useState(false)

  const deposer = useCallback(
    async (fichiers: FileList): Promise<void> => {
      const chemins = Array.from(fichiers).map((f) => window.telmi.fichiers.chemin(f))
      if (chemins.length === 0) return
      const r = await window.telmi.fichiers.decrire(chemins, 'audio')
      if (r.ok) d.ajouterChapitres(r.valeur)
      else d.setErreur(r.erreur)
    },
    [d]
  )

  const choisirAudios = async (): Promise<void> => {
    const r = await window.telmi.fichiers.choisirAudios()
    if (r.ok) d.ajouterChapitres(r.valeur)
    else d.setErreur(r.erreur)
  }

  const choisirImage = async (pour: 'couverture' | string): Promise<void> => {
    const r = await window.telmi.fichiers.choisirImage()
    if (!r.ok) return d.setErreur(r.erreur)
    const image = r.valeur[0]
    if (!image) return
    if (pour === 'couverture') d.majPack('couverture', image)
    else d.majChapitre(pour, { image })
  }

  const ajouterCouvertureUrl = (sources: SourceFichier[]): void => {
    const image = sources[0]
    if (image) d.majPack('couverture', image)
  }

  return (
    <div className="depot">
      {d.erreur && (
        <div className="erreur" role="alert">
          <strong>{d.erreur.message}</strong>
          {d.erreur.details && <code>{d.erreur.details}</code>}
          <button type="button" className="lien" onClick={() => d.setErreur(null)}>fermer</button>
        </div>
      )}

      {/* ---------------------------------------------------------- chapitres */}
      <section>
        <h2>Les pistes audio</h2>
        <p className="aide">
          Un seul mp3, ou un par chapitre. Le titre que tu donnes ici sera <strong>dit a voix
          haute</strong> par la conteuse : ecris-le comme tu le prononcerais.
        </p>

        <div
          className={survol ? 'depose survol' : 'depose'}
          onDragOver={(e) => {
            e.preventDefault()
            setSurvol(true)
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSurvol(false)
            void deposer(e.dataTransfer.files)
          }}
        >
          <p>Glisse tes mp3 ici</p>
          <button type="button" onClick={() => void choisirAudios()}>Parcourir…</button>
          <AjoutParUrl
            genre="audio"
            intitule="…ou colle l'adresse d'un mp3"
            onAjout={d.ajouterChapitres}
            onErreur={d.setErreur}
          />
        </div>

        {d.depot.chapitres.length > 0 && (
          <ul className="chapitres">
            {d.depot.chapitres.map((c, i) => (
              <LigneChapitre
                key={c.cle}
                chapitre={c}
                rang={i}
                total={d.depot.chapitres.length}
                onMaj={(modif) => d.majChapitre(c.cle, modif)}
                onRetirer={() => d.retirerChapitre(c.cle)}
                onDeplacer={(sens) => d.deplacerChapitre(c.cle, sens)}
                onChoisirImage={() => void choisirImage(c.cle)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ histoire */}
      <section>
        <h2>L&apos;histoire</h2>

        <div className="grille-histoire">
          <div className="champs">
            <label>
              Titre
              <input
                value={d.depot.titre}
                placeholder="Les contes de la mere Pauline"
                onChange={(e) => d.majPack('titre', e.target.value)}
              />
            </label>

            <div className="ligne-champs">
              <label>
                Age minimum
                <input
                  type="number"
                  min={0}
                  max={18}
                  value={d.depot.age}
                  onChange={(e) => d.majPack('age', Math.max(0, Math.min(18, Number(e.target.value) || 0)))}
                />
              </label>
              <label>
                Categorie
                <input
                  value={d.depot.categorie}
                  placeholder="Contes"
                  onChange={(e) => d.majPack('categorie', e.target.value)}
                />
              </label>
              <label>
                Langue
                <input
                  value={d.depot.langue}
                  maxLength={5}
                  onChange={(e) => d.majPack('langue', e.target.value)}
                />
              </label>
            </div>

            <label>
              Question du menu
              <input
                value={d.depot.question}
                onChange={(e) => d.majPack('question', e.target.value)}
              />
              <small>Dite avant la liste. Laisse vide pour aller droit au menu.</small>
            </label>

            <label>
              Description
              <textarea
                rows={5}
                value={d.depot.description}
                placeholder="De quoi parlent ces histoires, pour qui, par qui…"
                onChange={(e) => d.majPack('description', e.target.value)}
              />
            </label>
          </div>

          <div className="couverture">
            <h3>Couverture</h3>
            {d.depot.couverture ? (
              <img src={window.telmi.urlFichier(d.depot.couverture.id)} alt="" />
            ) : (
              <div className="image-absente grande">obligatoire</div>
            )}
            <button type="button" onClick={() => void choisirImage('couverture')}>
              {d.depot.couverture ? 'Changer' : 'Choisir une image'}
            </button>
            <AjoutParUrl genre="image" intitule="…ou une adresse" onAjout={ajouterCouvertureUrl} onErreur={d.setErreur} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- droits */}
      <section>
        <h2>Les droits</h2>
        <p className="aide">
          Obligatoire, et lu par la personne qui moderera. Une histoire dont les droits ne
          permettent pas la rediffusion sera refusee.
        </p>

        <div className="droits">
          {STATUTS.map((s) => (
            <label key={s.valeur} className={d.depot.droits.statut === s.valeur ? 'choix actif' : 'choix'}>
              <input
                type="radio"
                name="droits"
                checked={d.depot.droits.statut === s.valeur}
                onChange={() => d.majDroits('statut', s.valeur)}
              />
              <span className="choix-libelle">{s.libelle}</span>
              <span className="choix-aide">{s.aide}</span>
            </label>
          ))}
        </div>

        <div className="ligne-champs">
          <label>
            Source
            <input
              value={d.depot.droits.source}
              placeholder="https://… ou « enregistre par moi-meme »"
              onChange={(e) => d.majDroits('source', e.target.value)}
            />
          </label>
          <label>
            Declare par
            <input
              value={d.depot.droits.declare_par}
              placeholder="@pseudo"
              onChange={(e) => d.majDroits('declare_par', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------- recapitulatif */}
      <section className="recap">
        <h2>Recapitulatif</h2>

        <div className="totaux">
          <div><b>{d.depot.chapitres.length}</b><span>piste(s)</span></div>
          <div><b>{formaterDuree(d.dureeTotale)}</b><span>duree totale</span></div>
          <div><b>{formaterOctets(d.octetsTotal)}</b><span>fichiers deposes</span></div>
        </div>

        {d.problemes.length > 0 && (
          <div className="bloc-problemes">
            <h3>Il reste a faire</h3>
            <ul>
              {d.problemes.map((p, i) => (
                <li key={i}>{p.message}</li>
              ))}
            </ul>
          </div>
        )}

        {d.avertissements.length > 0 && (
          <div className="bloc-avertissements">
            <h3>Bon a savoir</h3>
            <ul>
              {d.avertissements.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="principal" disabled={!d.pret}>
          Fabriquer le pack
        </button>
        {d.pret && (
          <p className="aide">
            La fabrication est le lot suivant : ce bouton sera branche sur la generation du
            pack Telmi.
          </p>
        )}
      </section>
    </div>
  )
}

export default EcranDepot
