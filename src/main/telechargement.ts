import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { GenreFichier, Resultat } from '@shared/ipc'
import { EXTENSIONS } from '@shared/ipc'
import type { SourceFichier } from '@shared/types'
import { decrire } from './fichiers'

/** Dossier de travail, purge au demarrage suivant. */
const dossierTravail = join(tmpdir(), 'telmi-store-travail')

const TYPES_ACCEPTES: Record<GenreFichier, readonly string[]> = {
  audio: ['audio/mpeg', 'audio/mp3'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
}

const EXTENSION_DEPUIS_TYPE: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
}

/** Un nom de fichier lisible, deduit de l'URL puis du type annonce. */
const nomDepuisUrl = (url: string, type: string, genre: GenreFichier): string => {
  let base = 'telechargement'
  try {
    const chemin = new URL(url).pathname
    const brut = decodeURIComponent(basename(chemin))
    if (brut && brut !== '/') base = brut
  } catch {
    /* URL invalide : le nom par defaut fera l'affaire */
  }
  const ext = extname(base).slice(1).toLowerCase()
  if (EXTENSIONS[genre].includes(ext)) return base
  return base.replace(/\.[^.]*$/, '') + (EXTENSION_DEPUIS_TYPE[type] ?? '.' + EXTENSIONS[genre][0])
}

/** Appelee au fil du telechargement. `total` est nul si le serveur ne l'annonce pas. */
export type SurProgression = (recu: number, total: number | null) => void

export const telecharger = async (
  url: string,
  genre: GenreFichier,
  surProgression: SurProgression = () => {}
): Promise<Resultat<SourceFichier>> => {
  let adresse: URL
  try {
    adresse = new URL(url)
  } catch {
    return { ok: false, erreur: { code: 'url/invalide', message: "Cette adresse n'est pas une URL valide.", details: url } }
  }
  if (adresse.protocol !== 'https:' && adresse.protocol !== 'http:') {
    return {
      ok: false,
      erreur: { code: 'url/protocole', message: 'Seules les adresses http et https sont acceptees.', details: adresse.protocol }
    }
  }

  let reponse: Response
  try {
    // 60 s pour repondre : au-dela, on prefere un message a un compteur qui tourne.
    reponse = await fetch(adresse, { signal: AbortSignal.timeout(60_000), redirect: 'follow' })
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      erreur: {
        code: 'url/injoignable',
        message: "Cette adresse ne repond pas. Verifie le lien et ta connexion.",
        details: cause
      }
    }
  }

  if (!reponse.ok || reponse.body === null) {
    return {
      ok: false,
      erreur: {
        code: 'url/statut',
        message: `Le serveur a repondu ${reponse.status}. Le lien est peut-etre expire ou prive.`,
        details: `${reponse.status} ${reponse.statusText} — ${url}`
      }
    }
  }

  const type = (reponse.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (type !== '' && !TYPES_ACCEPTES[genre].includes(type)) {
    const attendu = genre === 'audio' ? 'un mp3' : 'une image'
    return {
      ok: false,
      erreur: {
        code: 'url/mauvais-type',
        message: `Cette adresse ne renvoie pas ${attendu} mais « ${type} ».`,
        details: url
      }
    }
  }

  const total = Number(reponse.headers.get('content-length')) || null
  const nom = nomDepuisUrl(url, type, genre)
  const cible = join(dossierTravail, randomUUID(), nom)

  try {
    await mkdir(join(cible, '..'), { recursive: true })
  } catch (e) {
    return {
      ok: false,
      erreur: {
        code: 'travail/dossier',
        message: 'Impossible de creer le dossier de travail.',
        details: e instanceof Error ? e.message : String(e)
      }
    }
  }

  let recu = 0
  let derniereAnnonce = 0
  const flux = Readable.fromWeb(reponse.body as never)
  flux.on('data', (morceau: Buffer) => {
    recu += morceau.length
    // On n'inonde pas l'interface : au plus une annonce toutes les 120 ms.
    const maintenant = Date.now()
    if (maintenant - derniereAnnonce < 120) return
    derniereAnnonce = maintenant
    surProgression(recu, total)
  })

  try {
    await pipeline(flux, createWriteStream(cible))
  } catch (e) {
    await rm(join(cible, '..'), { recursive: true, force: true })
    return {
      ok: false,
      erreur: {
        code: 'url/interrompu',
        message: 'Le telechargement a ete interrompu. Reessaie.',
        details: e instanceof Error ? e.message : String(e)
      }
    }
  }

  surProgression(recu, total ?? recu)
  return decrire(cible, genre, url)
}

/** Purge le dossier de travail : les telechargements ne survivent pas a la session. */
export const nettoyerTravail = async (): Promise<void> => {
  await rm(dossierTravail, { recursive: true, force: true })
}
