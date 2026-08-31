import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { registerProtocolScheme, serveProtocol } from './protocol'
import { clearWorkDir } from './download'

const isDev = !app.isPackaged

// Must run before app.whenReady(): the scheme has to be known before any load.
registerProtocolScheme()

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
  if (isDev && devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await clearWorkDir()
  serveProtocol()

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void clearWorkDir()
})
