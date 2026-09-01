import { shell } from 'electron'
import type { Shell } from '@domain/ports'

/** The desktop around the application. Never opens anything inside the window. */
export const createElectronShell = (): Shell => ({
  async openUrl(url: string): Promise<void> {
    await shell.openExternal(url)
  },
  async revealFile(path: string): Promise<void> {
    shell.showItemInFolder(path)
  }
})
