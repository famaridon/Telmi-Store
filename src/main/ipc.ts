import { BrowserWindow, ipcMain } from 'electron'
import { causeOf, fail } from '@domain/errors'
import type { Ports } from '@domain/ports'
import { admitPaths, fetchFromUrl, listLibrary, pickFiles } from '@app/usecases'
import type { Answer, Channel, Params } from '@shared/contract'
import { CHANNELS } from '@shared/contract'

/**
 * Transport layer: turns channels into use-case calls. It holds no rule of its
 * own, and guarantees that no exception ever crosses the boundary — anything
 * escaping becomes a described failure.
 */
const handle = <C extends Channel>(channel: C, work: (params: Params<C>) => Promise<Answer<C>>): void => {
  ipcMain.handle(channel, async (_event, params: Params<C>): Promise<Answer<C>> => {
    try {
      return await work(params)
    } catch (e) {
      return fail({ code: 'internal/unexpected', cause: causeOf(e) })
    }
  })
}

/** The current window, resolved at call time: handlers register only once. */
const currentWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null

export const registerIpc = (ports: Ports): void => {
  handle('library:list', () => listLibrary(ports))
  handle('files:pick', ({ kind, multiple }) => pickFiles(ports, kind, multiple))
  handle('files:admit', ({ paths, kind }) => admitPaths(ports, paths, kind))
  handle('files:fetch', ({ url, kind }) =>
    fetchFromUrl(ports, url, kind, (received, total) => {
      const window = currentWindow()
      if (window !== null && !window.isDestroyed()) {
        window.webContents.send('fetch:progress', { url, received, total })
      }
    })
  )
}

/** Removes every handler, so a reload cannot register them twice. */
export const unregisterIpc = (): void => {
  for (const channel of CHANNELS) ipcMain.removeHandler(channel)
}
