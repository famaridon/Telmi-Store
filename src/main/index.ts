import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { enregistrerIpc } from './ipc'

const estDev = !app.isPackaged

const creerFenetre = (): void => {
  const fenetre = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Telmi Store',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Contrairement a Telmi-Sync, le renderer n'a AUCUN acces a Node.
      // Voir docs/archi.md, section « Isolation du renderer ».
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  fenetre.on('ready-to-show', () => fenetre.show())

  // Un lien externe s'ouvre dans le navigateur, jamais dans l'application.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const urlDev = process.env['ELECTRON_RENDERER_URL']
  if (estDev && urlDev) {
    void fenetre.loadURL(urlDev)
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  enregistrerIpc()
  creerFenetre()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
