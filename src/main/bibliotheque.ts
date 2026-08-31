import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HistoireLocale } from '@shared/types'
import type { Resultat } from '@shared/ipc'

/**
 * Bibliotheque de Telmi-Sync. Lue en SEULE LECTURE : cette application ne
 * modifie jamais ~/.telmi, qui appartient a Telmi-Sync.
 */
const cheminBibliotheque = (): string => join(homedir(), '.telmi', 'stories')

interface MetadataPack {
  title?: string
  uuid?: string
  version?: number
  age?: number
  category?: string
  description?: string
}

/** Taille et nombre de fichiers d'un dossier, en descendant recursivement. */
const peser = async (chemin: string): Promise<{ poids: number; nbFichiers: number }> => {
  let poids = 0
  let nbFichiers = 0
  const entrees = await readdir(chemin, { withFileTypes: true })
  for (const entree of entrees) {
    const sous = join(chemin, entree.name)
    if (entree.isDirectory()) {
      const r = await peser(sous)
      poids += r.poids
      nbFichiers += r.nbFichiers
    } else if (entree.isFile()) {
      poids += (await stat(sous)).size
      nbFichiers += 1
    }
  }
  return { poids, nbFichiers }
}

export const listerBibliotheque = async (): Promise<Resultat<HistoireLocale[]>> => {
  const racine = cheminBibliotheque()

  let dossiers: string[]
  try {
    dossiers = (await readdir(racine, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch (e) {
    return {
      ok: false,
      erreur: {
        code: 'bibliotheque/introuvable',
        message:
          "Aucune bibliotheque Telmi-Sync n'a ete trouvee. Installe et lance Telmi-Sync " +
          'au moins une fois, puis reviens ici.',
        details: `${racine} — ${e instanceof Error ? e.message : String(e)}`
      }
    }
  }

  const histoires: HistoireLocale[] = []
  for (const dossier of dossiers) {
    const chemin = join(racine, dossier)
    let md: MetadataPack
    try {
      md = JSON.parse(await readFile(join(chemin, 'metadata.json'), 'utf8')) as MetadataPack
    } catch {
      // Un dossier sans metadata.json lisible n'est pas une histoire : on l'ignore
      // en silence plutot que de faire echouer toute la liste.
      continue
    }
    const { poids, nbFichiers } = await peser(chemin)
    histoires.push({
      dossier,
      titre: md.title ?? dossier,
      uuid: md.uuid ?? '',
      version: md.version ?? 0,
      age: md.age ?? 0,
      categorie: md.category ?? '',
      description: md.description ?? '',
      poids,
      nbFichiers
    })
  }

  histoires.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  return { ok: true, valeur: histoires }
}
