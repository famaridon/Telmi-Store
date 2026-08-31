import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { protocol } from 'electron'
import { Readable } from 'node:stream'
import { cheminAutorise } from './fichiers'

/**
 * Protocole `telmi-fichier://` : laisse l'interface AFFICHER une couverture et
 * ECOUTER un chapitre, sans lui donner acces au disque.
 *
 * Le renderer ne connait qu'un identifiant opaque. Seuls les fichiers que le
 * contributeur a explicitement choisis sont servis : ni chemin, ni traversee de
 * repertoire possible depuis l'interface.
 */
export const SCHEME = 'telmi-fichier'

/** A appeler AVANT app.whenReady(). */
export const declarerProtocole = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
    }
  ])
}

const TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
}

/** `telmi-fichier://local/<id>` */
export const urlDeFichier = (id: string): string => `${SCHEME}://local/${id}`

/** A appeler APRES app.whenReady(). */
export const servirProtocole = (): void => {
  protocol.handle(SCHEME, async (requete) => {
    const id = new URL(requete.url).pathname.replace(/^\//, '')
    const chemin = cheminAutorise(id)
    if (chemin === null) return new Response('inconnu', { status: 404 })

    let taille: number
    try {
      taille = (await stat(chemin)).size
    } catch {
      return new Response('introuvable', { status: 404 })
    }

    const type = TYPES[extname(chemin).toLowerCase()] ?? 'application/octet-stream'
    const entetes: Record<string, string> = { 'Content-Type': type, 'Accept-Ranges': 'bytes' }

    // Un element <audio> demande des plages pour pouvoir se deplacer dans la piste.
    const plage = requete.headers.get('Range')
    const m = plage?.match(/^bytes=(\d*)-(\d*)$/)
    if (m) {
      const debut = m[1] ? Number(m[1]) : 0
      const fin = m[2] ? Math.min(Number(m[2]), taille - 1) : taille - 1
      if (debut > fin || debut >= taille) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${taille}` } })
      }
      const flux = Readable.toWeb(createReadStream(chemin, { start: debut, end: fin })) as ReadableStream
      return new Response(flux, {
        status: 206,
        headers: {
          ...entetes,
          'Content-Range': `bytes ${debut}-${fin}/${taille}`,
          'Content-Length': String(fin - debut + 1)
        }
      })
    }

    const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream
    return new Response(flux, { status: 200, headers: { ...entetes, 'Content-Length': String(taille) } })
  })
}
