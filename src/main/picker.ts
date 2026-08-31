import { BrowserWindow, dialog } from 'electron'
import type { Result } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { FileKind, PickedFile } from '@shared/types'
import { describeAll } from './files'

/** Native picker. The only part of file handling that depends on Electron. */
export const pick = async (kind: FileKind, multiple: boolean): Promise<Result<PickedFile[]>> => {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!window) {
    return { ok: false, error: { code: 'internal/no-window', message: 'Aucune fenêtre disponible.' } }
  }

  const r = await dialog.showOpenDialog(window, {
    title: kind === 'audio' ? 'Choisir un ou plusieurs mp3' : 'Choisir une image',
    buttonLabel: 'Ajouter',
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: kind === 'audio' ? 'Fichiers audio' : 'Images', extensions: [...EXTENSIONS[kind]] }]
  })
  if (r.canceled) return { ok: true, value: [] }
  return describeAll(r.filePaths, kind)
}
