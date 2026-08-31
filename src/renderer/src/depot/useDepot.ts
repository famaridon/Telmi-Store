import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Chapitre, Depot, SourceFichier, StatutDroits } from '@shared/types'
import type { ErreurIpc } from '@shared/ipc'

export const DEPOT_VIDE: Depot = {
  titre: '',
  age: 3,
  categorie: '',
  langue: 'fr',
  description: '',
  question: 'Quelle histoire veux-tu ecouter ?',
  couverture: null,
  chapitres: [],
  droits: { statut: '', source: '', declare_par: '' }
}

export const STATUTS: readonly { valeur: StatutDroits; libelle: string; aide: string }[] = [
  { valeur: 'cree-par-le-contributeur', libelle: "J'en suis l'auteur", aide: "Tu as enregistre l'audio et tu detiens les images." },
  { valeur: 'domaine-public', libelle: 'Domaine public', aide: "L'oeuvre n'est plus protegee. Indique ou tu l'as trouvee." },
  { valeur: 'cc-by', libelle: 'Creative Commons BY', aide: "Reutilisable avec attribution. Indique l'auteur et la source." },
  { valeur: 'cc-by-sa', libelle: 'Creative Commons BY-SA', aide: 'Comme BY, avec partage aux memes conditions.' },
  { valeur: 'autorisation-ecrite', libelle: "J'ai une autorisation ecrite", aide: "Tu as l'accord du titulaire des droits." }
]

/** 2 Gio : la limite d'un fichier attache a une release GitHub. */
export const LIMITE_OCTETS = 2 * 1024 ** 3

/** Titre lisible depuis un nom de fichier : « 03 - Le Loup.mp3 » -> « Le Loup ». */
export const titreDepuisNom = (nom: string): string =>
  nom
    .replace(/\.[^.]+$/, '')
    .replace(/^[\s\d]+[-_.)\]]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const formaterOctets = (o: number): string =>
  o >= 1024 ** 3 ? `${(o / 1024 ** 3).toFixed(2)} Go`
    : o >= 1024 ** 2 ? `${(o / 1024 ** 2).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(o / 1024))} Ko`

export const formaterDuree = (s: number | null): string => {
  if (s === null) return '—'
  const t = Math.round(s)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

export interface Probleme {
  champ: string
  message: string
}

export interface EtatDepot {
  depot: Depot
  majPack: <K extends keyof Depot>(champ: K, valeur: Depot[K]) => void
  majDroits: (champ: keyof Depot['droits'], valeur: string) => void
  ajouterChapitres: (sources: SourceFichier[]) => void
  majChapitre: (cle: string, modif: Partial<Chapitre>) => void
  retirerChapitre: (cle: string) => void
  deplacerChapitre: (cle: string, sens: -1 | 1) => void
  erreur: ErreurIpc | null
  setErreur: (e: ErreurIpc | null) => void
  occupe: string | null
  setOccupe: (s: string | null) => void
  problemes: Probleme[]
  avertissements: string[]
  octetsTotal: number
  dureeTotale: number | null
  pret: boolean
}

let compteur = 0
const nouvelleCle = (): string => `c${++compteur}`

export const useDepot = (): EtatDepot => {
  const [depot, setDepot] = useState<Depot>(DEPOT_VIDE)
  const [erreur, setErreur] = useState<ErreurIpc | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)

  const majPack = useCallback(<K extends keyof Depot>(champ: K, valeur: Depot[K]) => {
    setDepot((d) => ({ ...d, [champ]: valeur }))
  }, [])

  const majDroits = useCallback((champ: keyof Depot['droits'], valeur: string) => {
    setDepot((d) => ({ ...d, droits: { ...d.droits, [champ]: valeur } }))
  }, [])

  const ajouterChapitres = useCallback((sources: SourceFichier[]) => {
    setDepot((d) => ({
      ...d,
      chapitres: [
        ...d.chapitres,
        ...sources.map((audio) => ({
          cle: nouvelleCle(),
          titre: titreDepuisNom(audio.nom),
          audio,
          duree: null,
          image: null
        }))
      ]
    }))
  }, [])

  const majChapitre = useCallback((cle: string, modif: Partial<Chapitre>) => {
    setDepot((d) => ({
      ...d,
      chapitres: d.chapitres.map((c) => (c.cle === cle ? { ...c, ...modif } : c))
    }))
  }, [])

  const retirerChapitre = useCallback((cle: string) => {
    setDepot((d) => ({ ...d, chapitres: d.chapitres.filter((c) => c.cle !== cle) }))
  }, [])

  const deplacerChapitre = useCallback((cle: string, sens: -1 | 1) => {
    setDepot((d) => {
      const i = d.chapitres.findIndex((c) => c.cle === cle)
      const j = i + sens
      if (i < 0 || j < 0 || j >= d.chapitres.length) return d
      const liste = [...d.chapitres]
      const a = liste[i]!
      liste[i] = liste[j]!
      liste[j] = a
      return { ...d, chapitres: liste }
    })
  }, [])

  /**
   * La duree vient d'un element <audio> : le fichier est servi par le protocole
   * maison, et le navigateur lit ses metadonnees sans decoder la piste.
   */
  useEffect(() => {
    const aMesurer = depot.chapitres.filter((c) => c.duree === null)
    if (aMesurer.length === 0) return

    const elements: HTMLAudioElement[] = []
    for (const chapitre of aMesurer) {
      const el = new Audio(window.telmi.urlFichier(chapitre.audio.id))
      el.preload = 'metadata'
      const fini = (): void => {
        majChapitre(chapitre.cle, { duree: Number.isFinite(el.duration) ? el.duration : 0 })
      }
      el.addEventListener('loadedmetadata', fini, { once: true })
      el.addEventListener('error', () => majChapitre(chapitre.cle, { duree: 0 }), { once: true })
      elements.push(el)
    }
    return () => {
      for (const el of elements) el.src = ''
    }
  }, [depot.chapitres, majChapitre])

  const octetsTotal = useMemo(
    () =>
      depot.chapitres.reduce((t, c) => t + c.audio.octets + (c.image?.octets ?? 0), 0) +
      (depot.couverture?.octets ?? 0),
    [depot.chapitres, depot.couverture]
  )

  const dureeTotale = useMemo(() => {
    if (depot.chapitres.length === 0) return null
    if (depot.chapitres.some((c) => c.duree === null)) return null
    return depot.chapitres.reduce((t, c) => t + (c.duree ?? 0), 0)
  }, [depot.chapitres])

  const problemes = useMemo<Probleme[]>(() => {
    const p: Probleme[] = []
    if (depot.titre.trim() === '') p.push({ champ: 'titre', message: "L'histoire n'a pas de titre." })
    if (depot.couverture === null) p.push({ champ: 'couverture', message: 'Il manque une image de couverture.' })
    if (depot.chapitres.length === 0) p.push({ champ: 'chapitres', message: 'Ajoute au moins un fichier audio.' })
    const sansTitre = depot.chapitres.filter((c) => c.titre.trim() === '').length
    if (sansTitre > 0) {
      p.push({
        champ: 'chapitres',
        message: sansTitre === 1 ? 'Un chapitre est sans titre.' : `${sansTitre} chapitres sont sans titre.`
      })
    }
    if (depot.droits.statut === '') p.push({ champ: 'droits', message: "Precise l'origine des droits." })
    if (depot.droits.source.trim() === '') p.push({ champ: 'droits', message: 'Indique la source du contenu.' })
    if (depot.droits.declare_par.trim() === '') p.push({ champ: 'droits', message: 'Indique qui declare ces droits.' })
    if (octetsTotal > LIMITE_OCTETS) {
      p.push({
        champ: 'chapitres',
        message: `Le pack depasse 2 Go (${formaterOctets(octetsTotal)}) : aucune release ne l'accepterait. Retire des chapitres.`
      })
    }
    return p
  }, [depot, octetsTotal])

  const avertissements = useMemo(() => {
    const a: string[] = []
    const titres = depot.chapitres.map((c) => c.titre.trim().toLowerCase()).filter((t) => t !== '')
    if (new Set(titres).size !== titres.length) {
      a.push('Deux chapitres portent le meme titre : ils seront annonces a l\'identique.')
    }
    const sansImage = depot.chapitres.filter((c) => c.image === null).length
    if (sansImage > 0 && depot.couverture !== null) {
      a.push(
        sansImage === depot.chapitres.length
          ? 'Aucun chapitre n\'a d\'image : la couverture sera utilisee pour tous.'
          : `${sansImage} chapitre(s) sans image : la couverture sera utilisee.`
      )
    }
    if (octetsTotal > 500 * 1024 ** 2 && octetsTotal <= LIMITE_OCTETS) {
      a.push(`${formaterOctets(octetsTotal)} a envoyer : prevois plusieurs minutes de publication.`)
    }
    if (depot.description.trim() === '') {
      a.push('Sans description, le moderateur aura peu d\'elements pour juger.')
    }
    return a
  }, [depot, octetsTotal])

  return {
    depot,
    majPack,
    majDroits,
    ajouterChapitres,
    majChapitre,
    retirerChapitre,
    deplacerChapitre,
    erreur,
    setErreur,
    occupe,
    setOccupe,
    problemes,
    avertissements,
    octetsTotal,
    dureeTotale,
    pret: problemes.length === 0
  }
}
