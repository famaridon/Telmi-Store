import type { DeclineReason } from '@domain/moderation'
import type { StoreEntry } from '@domain/model'

/**
 * The frequent reasons for a refusal, each with the message it pre-writes.
 *
 * This file exists so that saying no, with a reason, takes three clicks. A
 * refusal that costs a paragraph is a refusal nobody makes — and a store nobody
 * refuses anything in is a dumping ground.
 *
 * Every message is a draft: the moderator can and should adjust it. What matters
 * is that the blank page is never the starting point.
 */
export const DECLINE_REASONS: readonly {
  value: DeclineReason
  label: string
  draft: (entry: StoreEntry) => string
}[] = [
  {
    value: 'rights-unclear',
    label: 'Droits pas clairs',
    draft: (entry) =>
      `Merci pour cette proposition. La déclaration de droits ne me permet pas de trancher : la source indiquée (${entry.rights.source || 'aucune'}) ne dit pas assez clairement que la rediffusion est permise.\n\nSi tu peux préciser d'où vient l'audio et sous quelle licence, repropose-la — je la réexaminerai volontiers.`
  },
  {
    value: 'rights-refused',
    label: 'Droits insuffisants',
    draft: () =>
      "Merci pour cette proposition, mais les droits ne permettent pas de la rediffuser dans ce store. Ce n'est pas un jugement sur l'histoire : je ne peux simplement pas la publier ici.\n\nSi tu obtiens une autorisation écrite du titulaire, repropose-la."
  },
  {
    value: 'audio-quality',
    label: 'Qualité audio',
    draft: () =>
      "Merci pour cette proposition. J'ai écouté, et la qualité sonore ne tiendra pas sur la petite enceinte d'une conteuse : c'est trop bas, saturé ou bruité selon les passages.\n\nSi tu peux repartir d'un enregistrement plus propre, repropose-la."
  },
  {
    value: 'off-scope',
    label: 'Hors périmètre',
    draft: (entry) =>
      `Merci pour cette proposition. Elle sort du périmètre de ce store — l'âge annoncé (${entry.minAge}+) et le contenu ne correspondent pas à ce qu'on y publie.\n\nUn autre store lui conviendra peut-être mieux.`
  },
  {
    value: 'duplicate',
    label: 'Déjà dans le store',
    draft: (entry) =>
      `Merci, mais « ${entry.title} » est déjà dans le store. Si ta version apporte quelque chose de différent — une autre voix, une autre traduction — dis-le-moi et je regarderai à nouveau.`
  },
  {
    value: 'other',
    label: 'Autre raison',
    draft: () => 'Merci pour cette proposition. '
  }
]

/** The message an acceptance pre-writes, so it is never a bare merge. */
export const acceptDraft = (entry: StoreEntry): string =>
  `Écouté et accepté — merci ! « ${entry.title} » sera dans le store dès que l'index sera régénéré.`
