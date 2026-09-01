import { shell } from 'electron'
import type { Browser } from '@domain/ports'

/** Opens a URL in the contributor's real browser, never inside the window. */
export const createElectronBrowser = (): Browser => ({
  async open(url: string): Promise<void> {
    await shell.openExternal(url)
  }
})
