import { BrowserWindow, dialog } from 'electron'
import type { GenreFichier, Resultat } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { SourceFichier } from '@shared/types'
import { decrirePlusieurs } from './fichiers'

/** Selecteur natif. Seule partie de la gestion de fichiers a dependre d'Electron. */
export const choisir = async (genre: GenreFichier, multiple: boolean): Promise<Resultat<SourceFichier[]>> => {
  const fenetre = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!fenetre) {
    return { ok: false, erreur: { code: 'interne/sans-fenetre', message: 'Aucune fenetre disponible.' } }
  }

  const r = await dialog.showOpenDialog(fenetre, {
    title: genre === 'audio' ? 'Choisir un ou plusieurs mp3' : 'Choisir une image',
    buttonLabel: 'Ajouter',
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: genre === 'audio' ? 'Fichiers audio' : 'Images', extensions: [...EXTENSIONS[genre]] }]
  })
  if (r.canceled) return { ok: true, valeur: [] }
  return decrirePlusieurs(r.filePaths, genre)
}
