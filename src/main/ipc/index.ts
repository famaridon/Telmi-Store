import { BrowserWindow, ipcMain } from 'electron'
import type { Canal, Params, Reponse, Resultat } from '@shared/ipc'
import { listerBibliotheque } from '../bibliotheque'
import { decrirePlusieurs } from '../fichiers'
import { choisir } from '../selecteur'
import { telecharger } from '../telechargement'

/**
 * Enregistre un canal en garantissant qu'aucune exception ne traverse l'IPC :
 * tout ce qui echappe est converti en Resultat non-ok, avec un message lisible.
 */
const gerer = <C extends Canal>(
  canal: C,
  traitement: (params: Params<C>) => Promise<Resultat<Reponse<C>>>
): void => {
  ipcMain.handle(canal, async (_evenement, params: Params<C>): Promise<Resultat<Reponse<C>>> => {
    try {
      return await traitement(params)
    } catch (e) {
      return {
        ok: false,
        erreur: {
          code: 'interne/inattendu',
          message:
            'Une erreur inattendue est survenue. Si elle se reproduit, signale-la avec le detail ci-dessous.',
          details: e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        }
      }
    }
  })
}

/** La fenetre courante, resolue a l'appel : les handlers ne sont enregistres qu'une fois. */
const fenetreCourante = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null

export const enregistrerIpc = (): void => {
  gerer('bibliotheque:lister', listerBibliotheque)
  gerer('fichiers:choisir', ({ genre, multiple }) => choisir(genre, multiple))
  gerer('fichiers:decrire', ({ chemins, genre }) => decrirePlusieurs(chemins, genre))
  gerer('fichiers:telecharger', ({ url, genre }) =>
    telecharger(url, genre, (recu, total) => {
      const fenetre = fenetreCourante()
      if (fenetre !== null && !fenetre.isDestroyed()) {
        fenetre.webContents.send('telechargement:progression', { url, recu, total })
      }
    })
  )
}
