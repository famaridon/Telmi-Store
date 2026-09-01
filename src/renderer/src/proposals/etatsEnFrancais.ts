import type { ProposalState } from '@domain/proposals'

/** How each state is named and explained to the contributor. */
export const STATE_TEXT: Record<ProposalState, { label: string; hint: string; tone: string }> = {
  'under-review': {
    label: 'En relecture',
    hint: 'Quelqu’un du store doit encore l’écouter. Rien à faire de ton côté.',
    tone: 'attente'
  },
  'changes-requested': {
    label: 'À corriger',
    hint: 'On te demande quelque chose. Lis le message, corrige, et repropose : la même proposition sera mise à jour.',
    tone: 'alerte'
  },
  accepted: {
    label: 'Acceptée',
    hint: 'Ton histoire est dans le store. Elle apparaîtra dans Telmi-Sync chez tous ceux qui l’ont ajouté.',
    tone: 'ok'
  },
  declined: {
    label: 'Refusée',
    hint: 'Elle n’entrera pas dans ce store. Le message ci-dessous dit pourquoi.',
    tone: 'refus'
  }
}
