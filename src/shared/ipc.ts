import type { HistoireLocale, SourceFichier } from './types'

/**
 * Une erreur qui traverse l'IPC est toujours DECRITE, jamais lancee.
 *
 * Telmi-Sync avale ses erreurs de store dans un `console.log` : l'utilisateur voit
 * un compteur tourner indefiniment sans jamais savoir pourquoi. On ne reproduit pas
 * ca — d'ou ce type, impose a tous les canaux.
 */
export type Resultat<T> =
  | { ok: true; valeur: T }
  | { ok: false; erreur: ErreurIpc }

export interface ErreurIpc {
  /** Code stable, destine au code. Ex. 'bibliotheque/introuvable'. */
  code: string
  /** Phrase affichable telle quelle, en francais, qui dit quoi faire. */
  message: string
  /** Detail technique optionnel : chemin, statut HTTP, message d'origine. */
  details?: string
}

export type GenreFichier = 'audio' | 'image'

/**
 * Contrat des requetes : la seule surface par laquelle l'interface atteint le
 * systeme. Les types sont partages par les trois cibles, donc une signature
 * modifiee casse la compilation du main, du preload et du renderer a la fois.
 */
export interface Requetes {
  'bibliotheque:lister': { params: void; reponse: HistoireLocale[] }

  /** Ouvre un selecteur. Rend [] si l'utilisateur annule. */
  'fichiers:choisir': { params: { genre: GenreFichier; multiple: boolean }; reponse: SourceFichier[] }
  /** Decrit un chemin obtenu par glisser-deposer et l'autorise a l'affichage. */
  'fichiers:decrire': { params: { chemins: string[]; genre: GenreFichier }; reponse: SourceFichier[] }
  /** Telecharge une URL dans un dossier de travail. Progression par evenement. */
  'fichiers:telecharger': { params: { url: string; genre: GenreFichier }; reponse: SourceFichier }
}

export type Canal = keyof Requetes
export type Params<C extends Canal> = Requetes[C]['params']
export type Reponse<C extends Canal> = Requetes[C]['reponse']

export const CANAUX = [
  'bibliotheque:lister',
  'fichiers:choisir',
  'fichiers:decrire',
  'fichiers:telecharger'
] as const satisfies readonly Canal[]

/** Contrat des evenements pousses par le processus principal vers l'interface. */
export interface Evenements {
  'telechargement:progression': { url: string; recu: number; total: number | null }
}

export type CanalEvenement = keyof Evenements
export const CANAUX_EVENEMENTS = ['telechargement:progression'] as const satisfies readonly CanalEvenement[]

/** Extensions acceptees, cote selecteur comme cote glisser-deposer. */
export const EXTENSIONS: Record<GenreFichier, readonly string[]> = {
  audio: ['mp3'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
}
