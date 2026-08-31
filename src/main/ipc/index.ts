import { ipcMain } from 'electron'
import type { Canal, Reponse, Resultat } from '@shared/ipc'
import { listerBibliotheque } from '../bibliotheque'

/**
 * Enregistre un canal en garantissant qu'aucune exception ne traverse l'IPC :
 * tout ce qui echappe est converti en Resultat non-ok, avec un message lisible.
 */
const gerer = <C extends Canal>(
  canal: C,
  traitement: () => Promise<Resultat<Reponse<C>>>
): void => {
  ipcMain.handle(canal, async (): Promise<Resultat<Reponse<C>>> => {
    try {
      return await traitement()
    } catch (e) {
      return {
        ok: false,
        erreur: {
          code: 'interne/inattendu',
          message:
            "Une erreur inattendue est survenue. Si elle se reproduit, signale-la avec le detail ci-dessous.",
          details: e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        }
      }
    }
  })
}

export const enregistrerIpc = (): void => {
  gerer('bibliotheque:lister', listerBibliotheque)
}
