import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import type { Ports } from '@domain/ports'
import { createFsStoryLibrary } from '@infra/fsStoryLibrary'
import { createFsFileVault } from '@infra/fsFileVault'
import { createHttpFetcher } from '@infra/httpFetcher'
import { createElectronFilePicker } from '@infra/electronFilePicker'
import { registerFileScheme, serveFileScheme } from '@infra/electronFileProtocol'
import { createGitHubAuth } from '@infra/githubAuth'
import { createElectronTokenStore } from '@infra/electronTokenStore'
import { createElectronShell } from '@infra/electronShell'
import { createZipPackWriter } from '@infra/zipPackWriter'
import { GITHUB_CLIENT_ID } from '@infra/config'
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
    fetcher: createHttpFetcher(vault),
    auth: createGitHubAuth(GITHUB_CLIENT_ID),
    tokens: createElectronTokenStore(),
    shell: createElectronShell(),
    packs: createZipPackWriter(vault),
    sleep: (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  }
}

// Must run before app.whenReady(): the scheme has to exist before any load.
registerFileScheme()

const createWindow = (): void => {
  const window = new BrowserWindow({
    // Taille de repli si la fenetre est restauree : l'application s'ouvre
    // maximisee, mais une fenetre sait revenir a une taille normale.
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#2c1049',
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

  // Maximisee, pas en plein ecran : on garde les commandes de fenetre, parce que
  // cette application s'utilise a cote de Telmi-Sync. Pour du vrai plein ecran,
  // « fullscreen: true » ci-dessus suffirait.
  window.maximize()

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

/**
 * Electron refuses media access unless something answers for it. We grant the
 * microphone — the contributor records the menu labels — and nothing else:
 * without this, `getUserMedia` fails with no explanation.
 */
const answerPermissions = (): void => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media')
  })
}

app.whenReady().then(async () => {
  // Downloads do not outlive a session.
  await ports.vault.clear()
  answerPermissions()

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
