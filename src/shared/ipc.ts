import type { HistoireLocale } from './types'

/**
 * Une erreur qui traverse l'IPC est toujours DECRITE, jamais lancee.
 *
 * Telmi-Sync avale ses erreurs de store dans un `console.log` : l'utilisateur
 * voit un compteur tourner indefiniment sans jamais savoir pourquoi. On ne
 * reproduit pas ca — d'ou ce type, impose a tous les canaux.
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

/**
 * Contrat d'IPC : la seule surface par laquelle l'interface atteint le systeme.
 * Les types sont partages par les trois cibles, donc une signature modifiee
 * casse la compilation du main, du preload et du renderer a la fois.
 */
export interface Requetes {
  'bibliotheque:lister': { params: void; reponse: HistoireLocale[] }
}

export type Canal = keyof Requetes
export type Params<C extends Canal> = Requetes[C]['params']
export type Reponse<C extends Canal> = Requetes[C]['reponse']

export const CANAUX = ['bibliotheque:lister'] as const satisfies readonly Canal[]
