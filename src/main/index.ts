import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import type { Ports } from '@domain/ports'
import { createFsStoryLibrary } from '@infra/fsStoryLibrary'
import { createFsFileVault } from '@infra/fsFileVault'
import { createHttpFetcher } from '@infra/httpFetcher'
import { createElectronFilePicker } from '@infra/electronFilePicker'
import { registerFileScheme, serveFileScheme } from '@infra/electronFileProtocol'
import { registerIpc, unregisterIpc } from './ipc'

/**
 * Composition root: the single place where the abstract meets the concrete.
 *
 * Everything above this file — domain, use cases — knows only interfaces. This
 * is where they get their implementations, and the only place that has to change
 * when one of them does.
 */
const wire = (): Ports => {
  const vault = createFsFileVault()
  return {
    library: createFsStoryLibrary(),
    vault,
    picker: createElectronFilePicker(vault),
    fetcher: createHttpFetcher(vault)
  }
}

// Must run before app.whenReady(): the scheme has to exist before any load.
registerFileScheme()

const createWindow = (): void => {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Telmi Store',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Unlike Telmi-Sync, the renderer gets NO access to Node.
      // See docs/archi.md, "Isolation du renderer".
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // An external link opens in the browser, never inside the application.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const ports = wire()

app.whenReady().then(async () => {
  // Downloads do not outlive a session.
  await ports.vault.clear()

  serveFileScheme(ports.vault)
  unregisterIpc()
  registerIpc(ports)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void ports.vault.clear()
})
