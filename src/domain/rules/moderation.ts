import type { PackNodes, PackNotes } from '../pack'
import type { PackLocation, RightsStatus, StoreEntry } from '../model'

/**
 * Reading back what a proposal contains.
 *
 * These are the inverses of what the contributor's side writes, and they are
 * worth having as rules rather than as parsing scattered in an adapter: a
 * round-trip test then proves the two sides agree.
 */

const STATUS_FROM_FILE: Record<string, RightsStatus> = {
  'cree-par-le-contributeur': 'own-work',
  'domaine-public': 'public-domain',
  'cc-by': 'cc-by',
  'cc-by-sa': 'cc-by-sa',
  'autorisation-ecrite': 'written-permission'
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const packFromJson = (raw: Record<string, unknown>): PackLocation => {
  const sha256 = asString(raw['sha256'])
  const bytes = asNumber(raw['taille'])
  switch (raw['type']) {
    case 'pack-externe':
      return { kind: 'external', url: asString(raw['url']), sha256, bytes }
    case 'pack-depot':
      return {
        kind: 'repo-archive',
        repo: asString(raw['depot']),
        ...(typeof raw['branche'] === 'string' ? { branch: raw['branche'] } : {}),
        sha256,
        bytes
      }
    default:
      return {
        kind: 'release',
        repo: asString(raw['depot']),
        tag: asString(raw['tag']),
        file: asString(raw['fichier']),
        sha256,
        bytes
      }
  }
}

/**
 * The inverse of `entryToJson`: the moderator's side reads the same file the
 * contributor's side wrote. A tolerant reader on purpose — a malformed entry
 * should be shown and refused, not crash the screen.
 */
export const entryFromJson = (raw: unknown): StoreEntry => {
  const entry = asRecord(raw)
  const rights = asRecord(entry['droits'])
  return {
    slug: asString(entry['slug']),
    title: asString(entry['titre']),
    minAge: asNumber(entry['age']),
    category: asString(entry['categorie']),
    language: asString(entry['langue']),
    description: asString(entry['description']),
    uuid: asString(entry['uuid']),
    version: asNumber(entry['version']),
    rights: {
      status: STATUS_FROM_FILE[asString(rights['statut'])] ?? 'own-work',
      source: asString(rights['source']),
      declaredBy: asString(rights['declare_par'])
    },
    pack: packFromJson(asRecord(entry['pack']))
  }
}

/** Where a pack can be fetched from, whatever kind it is. */
export const packUrlOf = (pack: PackLocation): string => {
  switch (pack.kind) {
    case 'release':
      return `https://github.com/${pack.repo}/releases/download/${pack.tag}/${pack.file}`
    case 'external':
      return pack.url
    case 'repo-archive':
      return `${pack.repo}/archive/refs/heads/${pack.branch ?? 'main'}.zip`
  }
}

/**
 * The order the chapters are actually heard in, read from the pack itself.
 *
 * The menu order lives in `actions.m`, and each menu stage points at its chapter
 * through `ok.action`. Reading it rather than guessing from file names means a
 * pack built by anything — including Telmi-Sync's own Studio — plays in the
 * right order.
 */
export const playlistFromNodes = (
  nodes: PackNodes,
  notes: PackNotes
): { title: string; audio: string }[] => {
  const menu = nodes.actions['m'] ?? []
  const playlist: { title: string; audio: string }[] = []

  for (const step of menu) {
    const menuStage = nodes.stages[step.stage]
    if (menuStage === undefined) continue

    const chapterAction = menuStage.ok?.action
    const chapterStageName = chapterAction === undefined ? undefined : nodes.actions[chapterAction]?.[0]?.stage
    if (chapterStageName === undefined) continue

    const chapterStage = nodes.stages[chapterStageName]
    if (chapterStage?.audio == null) continue

    playlist.push({
      // The chapter's own note carries its spoken title; the menu note repeats it.
      title: notes[chapterStageName]?.title ?? notes[step.stage]?.notes ?? chapterStageName,
      audio: chapterStage.audio
    })
  }
  return playlist
}

/** The question the storyteller asks first, when the pack has one. */
export const questionFromNotes = (notes: PackNotes): string => notes['q']?.notes ?? ''
