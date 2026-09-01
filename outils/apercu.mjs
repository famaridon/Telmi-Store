#!/usr/bin/env node
// Capture les trois etats de l'interface dans outils/apercu/.
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ETATS = ['anonymous', 'waiting', 'signedIn', 'rempli']
const SORTIE = join(process.cwd(), 'outils', 'apercu')
mkdirSync(SORTIE, { recursive: true })

for (const etat of ETATS) {
  const fichier = join(SORTIE, `${etat}.png`)
  const r = spawnSync('npx', ['electron', join('outils', 'apercu.cjs')], {
    env: { ...process.env, ETAT_TEST: etat, SORTIE: fichier, HAUTEUR: process.env.HAUTEUR ?? '820' },
    stdio: 'ignore'
  })
  console.log(r.status === 0 ? `  ${etat} -> ${fichier}` : `  ${etat} : echec`)
}
