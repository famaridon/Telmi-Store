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

  // En etat « rempli », on pilote l'interface : deux clics et quelques champs,
  // pour voir l'ecran tel qu'il est une fois qu'on y a travaille.
  if (ETAT === 'rempli') {
    await f.webContents.executeJavaScript(`(async () => {
      const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
      const parTexte = (sel, texte) =>
        [...document.querySelectorAll(sel)].find((n) => n.textContent.trim().startsWith(texte))
      const saisir = (element, valeur) => {
        const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set
        setter.call(element, valeur)
        element.dispatchEvent(new Event('input', { bubbles: true }))
      }

      parTexte('button', 'Parcourir')?.click()
      await attendre(300)
      parTexte('button', 'Choisir une image')?.click()
      await attendre(300)

      const champs = [...document.querySelectorAll('label')]
      const par = (libelle) => champs.find((l) => l.textContent.trim().startsWith(libelle))?.querySelector('input, textarea')
      saisir(par('Titre'), 'Les contes de la mère Pauline')
      saisir(par('Catégorie'), 'Contes')
      saisir(par('Description'), 'Cinq contes écrits et lus par Pauline Pucciano.')
      saisir(par('Source'), 'https://litteratureaudio.com')
      saisir(par('Déclaré par'), '@famaridon')
      document.querySelector('input[name="rights"]')?.click()
      await attendre(400)
      // DEFILER : 'non' reste en haut, un titre de section s'y amene, sinon bas de page
      const ou = ${JSON.stringify(process.env.DEFILER ?? 'bas')}
      if (ou === 'bas') window.scrollTo(0, document.body.scrollHeight)
      else if (ou !== 'non') parTexte('h2', ou)?.scrollIntoView({ block: 'start' })
      await attendre(300)
    })()`)
    await new Promise((r) => setTimeout(r, 600))
  }
  const image = await f.webContents.capturePage()
  writeFileSync(SORTIE, image.toPNG())
  console.log('capture ->', SORTIE)
  app.exit(0)
})
