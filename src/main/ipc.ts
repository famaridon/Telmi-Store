import { BrowserWindow, ipcMain } from 'electron'
import type { DeviceCode } from '@domain/auth'
import { causeOf, fail, ok } from '@domain/errors'
import type { Ports } from '@domain/ports'
import { admitPaths, fetchFromUrl, listLibrary, pickFiles } from '@app/usecases'
import { restoreSession, signIn, signOut } from '@app/signIn'
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

const emit = <T>(channel: string, data: T): void => {
  const window = currentWindow()
  if (window !== null && !window.isDestroyed()) window.webContents.send(channel, data)
}

export const registerIpc = (ports: Ports): void => {
  handle('library:list', () => listLibrary(ports))
  handle('files:pick', ({ kind, multiple }) => pickFiles(ports, kind, multiple))
  handle('files:admit', ({ paths, kind }) => admitPaths(ports, paths, kind))
  handle('files:fetch', ({ url, kind }) =>
    fetchFromUrl(ports, url, kind, (received, total) => emit('fetch:progress', { url, received, total }))
  )

  // A sign-in lives longer than one call: the interface needs the code right
  // away, and must be able to give up. Hence the shared state below, held here
  // in the transport rather than in a use case.
  let cancelled = false
  let underWay: DeviceCode | null = null

  handle('auth:signIn', async () => {
    cancelled = false
    underWay = null
    const answer = await signIn(ports, {
      onCode: (code) => {
        underWay = code
        emit('auth:code', code)
      },
      isCancelled: () => cancelled
    })
    underWay = null
    return answer
  })

  handle('auth:cancel', async () => {
    cancelled = true
    return ok(undefined)
  })

  handle('auth:openVerification', async () => {
    if (underWay === null) return fail({ code: 'auth/no-session' })
    await ports.browser.open(underWay.verificationUri)
    return ok(undefined)
  })

  handle('auth:restore', () => restoreSession(ports))
  handle('auth:signOut', () => signOut(ports))
}

/** Removes every handler, so a reload cannot register them twice. */
export const unregisterIpc = (): void => {
  for (const channel of CHANNELS) ipcMain.removeHandler(channel)
}
