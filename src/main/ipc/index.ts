import { BrowserWindow, ipcMain } from 'electron'
import type { Channel, Params, Result, ResultOf } from '@shared/ipc'
import { listLibrary } from '../library'
import { describeAll } from '../files'
import { pick } from '../picker'
import { download } from '../download'

/**
 * Registers a channel while guaranteeing that no exception crosses the IPC
 * boundary: anything escaping becomes a non-ok Result with a readable message.
 */
const handle = <C extends Channel>(
  channel: C,
  work: (params: Params<C>) => Promise<Result<ResultOf<C>>>
): void => {
  ipcMain.handle(channel, async (_event, params: Params<C>): Promise<Result<ResultOf<C>>> => {
    try {
      return await work(params)
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'internal/unexpected',
          message:
            'Une erreur inattendue est survenue. Si elle se reproduit, signale-la avec le détail ci-dessous.',
          detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        }
      }
    }
  })
}

/** The current window, resolved at call time: handlers are registered only once. */
const currentWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null

export const registerIpc = (): void => {
  handle('library:list', listLibrary)
  handle('files:pick', ({ kind, multiple }) => pick(kind, multiple))
  handle('files:describe', ({ paths, kind }) => describeAll(paths, kind))
  handle('files:download', ({ url, kind }) =>
    download(url, kind, (received, total) => {
      const window = currentWindow()
      if (window !== null && !window.isDestroyed()) {
        window.webContents.send('download:progress', { url, received, total })
      }
    })
  )
}
