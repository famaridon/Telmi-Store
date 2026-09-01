/**
 * Capture d'ecran de l'interface, sans souris.
 *
 * Charge le rendu compile avec un `window.telmi` factice, attend le montage, et
 * enregistre une image. Cela permet de REGARDER un ecran avant de le declarer
 * fini — ce qui a deja debusque deux defauts : une action principale passee sous
 * la ligne de flottaison, et deux sequences numerotees 1-2-3 empilees.
 *
 *   npm run build
 *   node outils/apercu.mjs            # les trois etats, dans outils/apercu/
 */
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const RACINE = process.env.RACINE || process.cwd()
const SORTIE = process.env.SORTIE
const ETAT = process.env.ETAT_TEST || 'anonymous'

app.whenReady().then(async () => {
  const f = new BrowserWindow({
    width: 1180, height: parseInt(process.env.HAUTEUR || "820", 10), show: false,
    webPreferences: {
      preload: join(__dirname, 'apercu-preload.cjs'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  await f.loadFile(join(RACINE, 'out/renderer/index.html'))
  // Laisser le temps au montage, a la restauration et a l'evenement de code.
  await new Promise((r) => setTimeout(r, ETAT === 'waiting' ? 1800 : 1200))
  const image = await f.webContents.capturePage()
  writeFileSync(SORTIE, image.toPNG())
  console.log('capture ->', SORTIE)
  app.exit(0)
})
