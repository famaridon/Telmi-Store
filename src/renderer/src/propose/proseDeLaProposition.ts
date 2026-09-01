import type { StoreEntry } from '@domain/model'
import { RIGHTS_TEXT } from '../presentation/messages'

/**
 * The words a moderator reads.
 *
 * They live here, in the presentation layer, because they are French prose — and
 * because what a proposal *says* is a matter of wording, not of domain rules.
 * The body is deliberately a short table rather than a paragraph: someone
 * moderating twenty proposals wants to see the rights and the source at a
 * glance, not to read.
 */
export const proposalTitle = (entry: StoreEntry): string => `${entry.title} (${entry.minAge}+)`

export const proposalBody = (entry: StoreEntry, packUrl: string): string => {
  const rights = RIGHTS_TEXT[entry.rights.status]
  const lines = [
    `**${entry.title}**`,
    '',
    entry.description.trim() === '' ? '_Aucune description fournie._' : entry.description.trim(),
    '',
    '| | |',
    '| --- | --- |',
    `| Âge | ${entry.minAge}+ |`,
    `| Catégorie | ${entry.category || '—'} |`,
    `| Langue | ${entry.language} |`,
    `| Droits | ${rights.label} |`,
    `| Source | ${entry.rights.source} |`,
    `| Déclaré par | ${entry.rights.declaredBy} |`,
    '',
    `Le pack reste chez son auteur : ${packUrl}`,
    '',
    `Empreinte SHA-256 : \`${entry.pack.sha256}\``,
    '',
    '---',
    '',
    'Proposé depuis Telmi Store. Le store ne reçoit que cette fiche et sa vignette.'
  ]
  return lines.join('\n')
}
