/** Types du domaine, partages par le processus principal et l'interface. */

/** Une histoire deja installee par Telmi-Sync dans ~/.telmi/stories. */
export interface HistoireLocale {
  /** Nom du dossier, tel que Telmi-Sync l'a genere. Identifiant de fait. */
  dossier: string
  titre: string
  /** Doit etre repris tel quel dans la fiche : c'est lui qui identifie l'histoire. */
  uuid: string
  /** Entier >= 1. A 0 ou absent, Telmi-Sync ne proposera jamais de mise a jour. */
  version: number
  age: number
  categorie: string
  description: string
  /** Octets. Determine ou le pack pourra etre heberge. */
  poids: number
  nbFichiers: number
}

/** Ou trouver le pack d'une histoire publiee. Le store n'en heberge aucun. */
export type Pack =
  | { type: 'pack-release'; depot: string; tag: string; fichier: string; sha256: string; taille: number }
  | { type: 'pack-externe'; url: string; sha256: string; taille: number }
  | { type: 'pack-depot'; depot: string; branche?: string; sha256: string; taille: number }

export type StatutDroits =
  | 'cree-par-le-contributeur'
  | 'domaine-public'
  | 'cc-by'
  | 'cc-by-sa'
  | 'autorisation-ecrite'

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
