import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { GenreFichier, Resultat } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { SourceFichier } from '@shared/types'

/**
 * Table des fichiers que le contributeur a explicitement choisis. C'est la seule
 * porte d'entree du protocole `telmi-fichier://` : l'interface manipule des
 * identifiants, jamais des chemins.
 */
const autorises = new Map<string, string>()

export const cheminAutorise = (id: string): string | null => autorises.get(id) ?? null

const extensionAcceptee = (chemin: string, genre: GenreFichier): boolean =>
  EXTENSIONS[genre].includes(extname(chemin).slice(1).toLowerCase())

/** Autorise un chemin et rend sa description, ou une erreur explicite. */
export const decrire = async (chemin: string, genre: GenreFichier, url?: string): Promise<Resultat<SourceFichier>> => {
  if (!extensionAcceptee(chemin, genre)) {
    const attendues = EXTENSIONS[genre].join(', ')
    return {
      ok: false,
      erreur: {
        code: 'fichier/extension',
        message: `« ${basename(chemin)} » n'est pas un fichier accepte. Attendu : ${attendues}.`,
        details: chemin
      }
    }
  }

  let octets: number
  try {
    const infos = await stat(chemin)
    if (!infos.isFile()) {
      return {
        ok: false,
        erreur: { code: 'fichier/pas-un-fichier', message: `« ${basename(chemin)} » n'est pas un fichier.`, details: chemin }
      }
    }
    octets = infos.size
  } catch (e) {
    return {
      ok: false,
      erreur: {
        code: 'fichier/illisible',
        message: `Impossible de lire « ${basename(chemin)} ». Verifie qu'il existe toujours.`,
        details: e instanceof Error ? e.message : String(e)
      }
    }
  }

  if (octets === 0) {
    return {
      ok: false,
      erreur: { code: 'fichier/vide', message: `« ${basename(chemin)} » est vide.`, details: chemin }
    }
  }

  const id = randomUUID()
  autorises.set(id, chemin)
  return { ok: true, valeur: { id, nom: basename(chemin), octets, origine: url ? 'url' : 'fichier', ...(url ? { url } : {}) } }
}

/** Decrit plusieurs chemins ; une seule erreur suffit a faire echouer l'ensemble. */
export const decrirePlusieurs = async (chemins: string[], genre: GenreFichier): Promise<Resultat<SourceFichier[]>> => {
  const sources: SourceFichier[] = []
  for (const chemin of chemins) {
    const r = await decrire(chemin, genre)
    if (!r.ok) return r
    sources.push(r.valeur)
  }
  return { ok: true, valeur: sources }
}
