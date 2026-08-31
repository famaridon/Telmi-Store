import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CanalEvenement, Canal, Evenements, Params, Reponse, Resultat } from '@shared/ipc'
import { CANAUX, CANAUX_EVENEMENTS } from '@shared/ipc'

/**
 * Unique pont entre l'interface et le systeme. On n'expose pas `ipcRenderer` mais
 * des fonctions qui refusent tout canal absent du contrat : l'interface ne peut
 * donc pas inventer un appel.
 */
const invoquer = async <C extends Canal>(canal: C, params?: Params<C>): Promise<Resultat<Reponse<C>>> => {
  if (!(CANAUX as readonly string[]).includes(canal)) {
    return { ok: false, erreur: { code: 'ipc/canal-inconnu', message: 'Appel refuse.', details: canal } }
  }
  return (await ipcRenderer.invoke(canal, params)) as Resultat<Reponse<C>>
}

const api = {
  bibliotheque: {
    lister: () => invoquer('bibliotheque:lister')
  },

  fichiers: {
    choisirAudios: () => invoquer('fichiers:choisir', { genre: 'audio', multiple: true }),
    choisirImage: () => invoquer('fichiers:choisir', { genre: 'image', multiple: false }),
    decrire: (chemins: string[], genre: 'audio' | 'image') => invoquer('fichiers:decrire', { chemins, genre }),
    telecharger: (url: string, genre: 'audio' | 'image') => invoquer('fichiers:telecharger', { url, genre }),

    /**
     * Chemin d'un fichier obtenu par glisser-deposer. `webUtils` est la seule voie
     * depuis qu'Electron a retire `File.path`, et elle doit etre appelee ici.
     */
    chemin: (fichier: File) => webUtils.getPathForFile(fichier)
  },

  /** Abonnement a un evenement pousse par le processus principal. Rend un desabonnement. */
  sur: <C extends CanalEvenement>(canal: C, rappel: (donnees: Evenements[C]) => void): (() => void) => {
    if (!(CANAUX_EVENEMENTS as readonly string[]).includes(canal)) return () => {}
    const ecouteur = (_e: unknown, donnees: Evenements[C]): void => rappel(donnees)
    ipcRenderer.on(canal, ecouteur)
    return () => ipcRenderer.off(canal, ecouteur)
  },

  /** URL a donner a un <img> ou un <audio> pour un fichier autorise. */
  urlFichier: (id: string) => `telmi-fichier://local/${id}`
} as const

export type ApiTelmi = typeof api

contextBridge.exposeInMainWorld('telmi', api)
