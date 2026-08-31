/** Types du domaine, partages par le processus principal et l'interface. */

/** Une histoire deja installee par Telmi-Sync dans ~/.telmi/stories. */
export interface HistoireLocale {
  dossier: string
  titre: string
  uuid: string
  version: number
  age: number
  categorie: string
  description: string
  poids: number
  nbFichiers: number
}

/**
 * Un fichier choisi par le contributeur. L'interface ne voit jamais son contenu :
 * elle recoit un `id` qui lui permet de l'afficher ou de le lire via le protocole
 * `telmi-fichier://`, et le processus principal garde le chemin.
 */
export interface SourceFichier {
  id: string
  nom: string
  octets: number
  origine: 'fichier' | 'url'
  /** Renseignee si origine === 'url', pour pouvoir l'afficher et la re-telecharger. */
  url?: string
}

export interface Chapitre {
  /** Stable cote interface, pour le reordonnancement. */
  cle: string
  /** Devient le titre dit a voix haute. Pre-rempli avec le nom du fichier. */
  titre: string
  audio: SourceFichier
  /** Secondes, mesurees par l'interface via un element <audio>. */
  duree: number | null
  /** Facultative : a defaut, la couverture sera utilisee. */
  image: SourceFichier | null
}

export type StatutDroits =
  | 'cree-par-le-contributeur'
  | 'domaine-public'
  | 'cc-by'
  | 'cc-by-sa'
  | 'autorisation-ecrite'

export interface Droits {
  statut: StatutDroits | ''
  source: string
  declare_par: string
}

/** L'etat complet de l'ecran de depot. */
export interface Depot {
  titre: string
  age: number
  categorie: string
  langue: string
  description: string
  /** La question du menu, dite a voix haute avant la liste. */
  question: string
  couverture: SourceFichier | null
  chapitres: Chapitre[]
  droits: Droits
}

/** Ou trouver le pack d'une histoire publiee. Le store n'en heberge aucun. */
export type Pack =
  | { type: 'pack-release'; depot: string; tag: string; fichier: string; sha256: string; taille: number }
  | { type: 'pack-externe'; url: string; sha256: string; taille: number }
  | { type: 'pack-depot'; depot: string; branche?: string; sha256: string; taille: number }

/** Une fiche : ce qui est versionne dans le depot du store, et relu en moderation. */
export interface Fiche {
  slug: string
  titre: string
  age: number
  categorie: string
  langue: string
  description: string
  uuid: string
  version: number
  droits: { statut: StatutDroits; source: string; declare_par: string }
  pack: Pack
}
