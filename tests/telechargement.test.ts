import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { telecharger, nettoyerTravail } from '../src/main/telechargement'
import { cheminAutorise } from '../src/main/fichiers'

/** Un mp3 minuscule mais valide n'est pas necessaire : on ne decode rien. */
const CORPS = Buffer.alloc(64 * 1024, 7)

let serveur: Server
let base: string

beforeAll(async () => {
  serveur = createServer((req, res) => {
    const chemin = req.url ?? '/'
    if (chemin === '/piste.mp3') {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(CORPS.length) })
      res.end(CORPS)
    } else if (chemin === '/sans-taille.mp3') {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
      res.end(CORPS)
    } else if (chemin === '/page.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html></html>')
    } else if (chemin === '/prive') {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('non')
    } else if (chemin === '/redirige') {
      res.writeHead(302, { Location: '/piste.mp3' })
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r))
  const adr = serveur.address()
  base = `http://127.0.0.1:${typeof adr === 'object' && adr ? adr.port : 0}`
})

afterAll(async () => {
  await new Promise<void>((r) => serveur.close(() => r()))
  await nettoyerTravail()
})

describe('telecharger — succes', () => {
  it('recupere le fichier, l\'autorise a l\'affichage et le decrit', async () => {
    const r = await telecharger(`${base}/piste.mp3`, 'audio')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valeur.nom).toBe('piste.mp3')
    expect(r.valeur.octets).toBe(CORPS.length)
    expect(r.valeur.origine).toBe('url')
    // L'id doit ouvrir le protocole telmi-fichier, et le contenu doit correspondre.
    const chemin = cheminAutorise(r.valeur.id)
    expect(chemin).not.toBeNull()
    expect(readFileSync(chemin!).length).toBe(CORPS.length)
  })

  it('annonce la progression et finit sur le total reel', async () => {
    const vues: { recu: number; total: number | null }[] = []
    const r = await telecharger(`${base}/piste.mp3`, 'audio', (recu, total) => vues.push({ recu, total }))
    expect(r.ok).toBe(true)
    expect(vues.length).toBeGreaterThan(0)
    expect(vues.at(-1)).toEqual({ recu: CORPS.length, total: CORPS.length })
  })

  it('se debrouille quand le serveur n\'annonce pas la taille', async () => {
    const vues: (number | null)[] = []
    const r = await telecharger(`${base}/sans-taille.mp3`, 'audio', (_r, total) => vues.push(total))
    expect(r.ok).toBe(true)
    expect(vues.at(-1)).toBe(CORPS.length)
  })

  it('suit une redirection', async () => {
    const r = await telecharger(`${base}/redirige`, 'audio')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.valeur.octets).toBe(CORPS.length)
  })
})

describe('telecharger — echecs, chacun avec son message', () => {
  it('refuse une URL invalide', async () => {
    const r = await telecharger('pas une url', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur.code).toBe('url/invalide')
  })

  it('refuse un protocole autre que http(s)', async () => {
    const r = await telecharger('file:///etc/passwd', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur.code).toBe('url/protocole')
  })

  it('rapporte le statut HTTP', async () => {
    const r = await telecharger(`${base}/prive`, 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erreur.code).toBe('url/statut')
      expect(r.erreur.message).toContain('403')
    }
  })

  it('refuse une adresse qui renvoie autre chose qu\'un mp3', async () => {
    const r = await telecharger(`${base}/page.html`, 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.erreur.code).toBe('url/mauvais-type')
      expect(r.erreur.message).toContain('text/html')
    }
  })

  it('rapporte une adresse injoignable sans faire attendre indefiniment', async () => {
    const r = await telecharger('http://127.0.0.1:1/rien.mp3', 'audio')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur.code).toBe('url/injoignable')
  })

  it('accepte une image sur le canal image, la refuse sur le canal audio', async () => {
    expect((await telecharger(`${base}/piste.mp3`, 'image')).ok).toBe(false)
  })
})
