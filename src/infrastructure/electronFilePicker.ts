import { BrowserWindow, dialog } from 'electron'
import { fail, ok, type Result } from '@domain/errors'
import type { FileKind, PickedFile } from '@domain/model'
import type { FilePicker, FileVault } from '@domain/ports'
import { EXTENSIONS } from '@domain/rules/files'

/** Native picker. Whatever the user selects goes straight into the vault. */
export const createElectronFilePicker = (vault: FileVault): FilePicker => ({
  async pick(kind: FileKind, multiple: boolean): Promise<Result<PickedFile[]>> {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!window) return fail({ code: 'ui/no-window' })

    const chosen = await dialog.showOpenDialog(window, {
      title: kind === 'audio' ? 'Choisir un ou plusieurs mp3' : 'Choisir une image',
      buttonLabel: 'Ajouter',
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [{ name: kind === 'audio' ? 'Fichiers audio' : 'Images', extensions: [...EXTENSIONS[kind]] }]
    })
    if (chosen.canceled) return ok([])

    const files: PickedFile[] = []
    for (const path of chosen.filePaths) {
      const admitted = await vault.admit(path, kind)
      if (!admitted.ok) return admitted
      files.push(admitted.value)
    }
    return ok(files)
  }
})
