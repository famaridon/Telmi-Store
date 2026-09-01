import type { AppError } from '@domain/errors'
import type { Blocker, Warning } from '@domain/rules/submission'
import type { FileKind, RightsStatus } from '@domain/model'
import { EXTENSIONS } from '@domain/rules/files'

/**
 * The only place in the code where French is written.
 *
 * The domain returns failures as data; here they become sentences the user can
 * act on. Gathering them makes every message auditable at a glance, and the
 * exhaustive switches make an unhandled case a compilation error rather than a
 * blank screen.
 */

const impossible = (value: never): never => {
  throw new Error(`Cas non traité : ${JSON.stringify(value)}`)
}

const bytesText = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} Go`
    : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(bytes / 1024))} Ko`

const kindText = (kind: FileKind): string => (kind === 'audio' ? 'un mp3' : 'une image')

export interface ShownError {
  /** Shown as-is. Says what happened and what to do about it. */
  message: string
  /** Technical detail, for whoever wants to dig or report. */
  detail?: string
}

export const describeError = (error: AppError): ShownError => {
  switch (error.code) {
    case 'library/not-found':
      return {
        message:
          "Aucune bibliothèque Telmi-Sync n'a été trouvée. Installe et lance Telmi-Sync " +
          'au moins une fois, puis reviens ici.',
        detail: `${error.path} — ${error.cause}`
      }
    case 'file/bad-extension':
      return {
        message: `« ${error.name} » n'est pas un fichier accepté. Attendu : ${EXTENSIONS[error.kind].join(', ')}.`
      }
    case 'file/not-a-file':
      return { message: `« ${error.name} » n'est pas un fichier.` }
    case 'file/unreadable':
      return {
        message: `Impossible de lire « ${error.name} ». Vérifie qu'il existe toujours.`,
        detail: error.cause
      }
    case 'file/empty':
      return { message: `« ${error.name} » est vide.` }
    case 'url/invalid':
      return { message: "Cette adresse n'est pas une URL valide.", detail: error.url }
    case 'url/bad-protocol':
      return { message: 'Seules les adresses http et https sont acceptées.', detail: error.protocol }
    case 'url/unreachable':
      return { message: 'Cette adresse ne répond pas. Vérifie le lien et ta connexion.', detail: error.cause }
    case 'url/status':
      return {
        message: `Le serveur a répondu ${error.status}. Le lien est peut-être expiré ou privé.`,
        detail: `${error.status} ${error.statusText} — ${error.url}`
      }
    case 'url/wrong-type':
      return {
        message: `Cette adresse ne renvoie pas ${kindText(error.kind)} mais « ${error.type} ».`
      }
    case 'url/interrupted':
      return { message: 'Le téléchargement a été interrompu. Réessaie.', detail: error.cause }
    case 'workdir/unavailable':
      return { message: 'Impossible de créer le dossier de travail.', detail: error.cause }
    case 'auth/not-configured':
      return {
        message:
          "La connexion à GitHub n'est pas encore configurée : il manque l'identifiant de " +
          "l'application. Crée une OAuth App sur github.com/settings/applications/new, " +
          'coche « Enable Device Flow », puis renseigne son Client ID.',
        detail: 'variable TELMI_STORE_GITHUB_CLIENT_ID, ou src/infrastructure/config.ts'
      }
    case 'auth/device-flow-disabled':
      return {
        message:
          "L'OAuth App existe mais le Device Flow n'y est pas activé. Ouvre ses réglages sur " +
          'GitHub et coche « Enable Device Flow ».'
      }
    case 'auth/github-unreachable':
      return { message: 'GitHub ne répond pas. Vérifie ta connexion et réessaie.', detail: error.cause }
    case 'auth/github-refused':
      return {
        message: 'GitHub a refusé la demande de connexion.',
        detail: `${error.status} — ${error.body}`
      }
    case 'auth/denied':
      return { message: "La connexion a été refusée sur GitHub. Rien n'a été enregistré." }
    case 'auth/expired':
      return { message: 'Le code a expiré avant que la connexion soit autorisée. Recommence.' }
    case 'auth/cancelled':
      return { message: 'Connexion annulée.' }
    case 'auth/missing-scope':
      return {
        message:
          "Le jeton obtenu ne permet pas de publier : il manque l'autorisation sur les dépôts " +
          'publics. Reconnecte-toi en acceptant la permission demandée.',
        detail: `accordé : ${error.granted.join(', ') || 'aucune portée'}`
      }
    case 'auth/no-session':
      return { message: "Aucune connexion n'est en cours." }
    case 'token/unwritable':
      return {
        message:
          "Impossible d'enregistrer la connexion de façon sûre. Tu resteras connecté le temps " +
          "de cette session, mais il faudra recommencer au prochain démarrage.",
        detail: error.cause
      }
    case 'token/unreadable':
      return {
        message: 'Impossible de relire la connexion enregistrée. Reconnecte-toi.',
        detail: error.cause
      }
    case 'pack/missing-image':
      return {
        message:
          "Une image du pack n'a pas pu être fabriquée. Réessaie, et si cela se reproduit, " +
          'change l’image concernée.',
        detail: error.path
      }
    case 'pack/unknown-source':
      return {
        message:
          'Un fichier déposé a été perdu en route. Retire-le et ajoute-le à nouveau.',
        detail: error.path
      }
    case 'pack/unwritable':
      return {
        message: "Impossible d'écrire le pack. Vérifie l'espace disque disponible.",
        detail: error.cause
      }
    case 'voice/no-microphone':
      return {
        message:
          "Aucun micro n'a été trouvé. Branche-en un, ou passe cette étape : les titres seront " +
          'lus sur les images au lieu d’être dits.',
        detail: error.cause
      }
    case 'voice/denied':
      return {
        message:
          "L'accès au micro a été refusé. Autorise Telmi Store dans les réglages de ton système, " +
          'ou passe cette étape.'
      }
    case 'voice/encoding-failed':
      return {
        message: "L'enregistrement n'a pas pu être converti. Réessaie.",
        detail: error.cause
      }
    case 'github/refused':
      return {
        message: `GitHub a refusé une étape de la publication (${error.what}).`,
        detail: `${error.status} — ${error.body}`
      }
    case 'github/unreachable':
      return {
        message: 'GitHub ne répond pas. Vérifie ta connexion, puis relance la publication : elle reprendra où elle en était.',
        detail: error.cause
      }
    case 'github/upload-failed':
      return {
        message:
          "L'envoi du pack a été interrompu. Relance la publication : elle remplacera ce qui a " +
          'déjà été envoyé au lieu de créer un doublon.',
        detail: error.cause
      }
    case 'github/not-public':
      return {
        message:
          "Le pack a été envoyé mais son adresse ne répond pas encore. Attends un instant et " +
          'relance la vérification.',
        detail: `${error.status} — ${error.url}`
      }
    case 'github/size-mismatch':
      return {
        message:
          "Le pack publié ne fait pas la taille attendue : l'envoi est probablement incomplet. " +
          'Relance la publication.',
        detail: `attendu ${error.expected} octets, trouvé ${error.found}`
      }
    case 'propose/fork-too-slow':
      return {
        message:
          "GitHub met plus longtemps que d'habitude à préparer ta copie du store. Attends une " +
          'minute et relance : la proposition reprendra.',
        detail: error.repo
      }
    case 'propose/store-unreachable':
      return {
        message:
          "Ce store est introuvable. Il a peut-être été renommé, ou rendu privé.",
        detail: error.repo
      }
    case 'moderation/not-allowed':
      return {
        message:
          "Tu n'as pas les droits pour répondre aux propositions de ce store. Demande-les à la " +
          'personne qui le maintient.',
        detail: error.repo
      }
    case 'pack/checksum-mismatch':
      return {
        message:
          "Le pack téléchargé ne correspond pas à l'empreinte annoncée dans la fiche : il a été " +
          'remplacé depuis. À refuser, ou à faire republier.',
        detail: `annoncé ${error.expected.slice(0, 16)}…, trouvé ${error.found.slice(0, 16)}…`
      }
    case 'pack/unreadable-archive':
      return {
        message: "Ce pack ne peut pas être ouvert : l'archive est incomplète ou d'un autre format.",
        detail: error.cause
      }
    case 'pack/no-chapter':
      return {
        message: "Ce pack ne contient aucune piste jouable. Il n'a rien à faire dans un store.",
      }
    case 'ui/no-window':
      return { message: 'Aucune fenêtre disponible.' }
    case 'ipc/unknown-channel':
      return { message: 'Appel refusé.', detail: error.channel }
    case 'internal/unexpected':
      return {
        message:
          'Une erreur inattendue est survenue. Si elle se reproduit, signale-la avec le détail ci-dessous.',
        detail: error.cause
      }
    default:
      return impossible(error)
  }
}

export const describeBlocker = (blocker: Blocker): string => {
  switch (blocker.code) {
    case 'no-title':
      return "L'histoire n'a pas de titre."
    case 'no-cover':
      return 'Il manque une image de couverture.'
    case 'no-chapter':
      return 'Ajoute au moins un fichier audio.'
    case 'untitled-chapters':
      return blocker.count === 1 ? 'Une piste est sans titre.' : `${blocker.count} pistes sont sans titre.`
    case 'no-rights-status':
      return "Précise l'origine des droits."
    case 'no-rights-source':
      return 'Indique la source du contenu.'
    case 'no-rights-declarant':
      return 'Indique qui déclare ces droits.'
    case 'too-heavy':
      return `Le pack dépasse 2 Go (${bytesText(blocker.bytes)}) : aucune release ne l'accepterait. Retire des pistes.`
    default:
      return impossible(blocker)
  }
}

export const describeWarning = (warning: Warning): string => {
  switch (warning.code) {
    case 'duplicate-titles':
      return 'Deux pistes portent le même titre : elles seront annoncées à l’identique.'
    case 'chapters-without-image':
      return warning.count === warning.total
        ? 'Aucune piste n’a d’image : la couverture sera utilisée pour toutes.'
        : `${warning.count} piste(s) sans image : la couverture sera utilisée.`
    case 'slow-upload':
      return `${bytesText(warning.bytes)} à envoyer : prévois plusieurs minutes de publication.`
    case 'no-description':
      return 'Sans description, le modérateur aura peu d’éléments pour juger.'
    default:
      return impossible(warning)
  }
}

/** Wording the storyteller speaks before the menu, when the contributor keeps it. */
export const DEFAULT_QUESTION = 'Quelle histoire veux-tu écouter ?'

/** Label and explanation of each rights status, in the order of the form. */
export const RIGHTS_TEXT: Record<RightsStatus, { label: string; hint: string }> = {
  'own-work': {
    label: "J'en suis l'auteur",
    hint: "Tu as enregistré l'audio et tu détiens les images."
  },
  'public-domain': {
    label: 'Domaine public',
    hint: "L'œuvre n'est plus protégée. Indique où tu l'as trouvée."
  },
  'cc-by': {
    label: 'Creative Commons BY',
    hint: "Réutilisable avec attribution. Indique l'auteur et la source."
  },
  'cc-by-sa': {
    label: 'Creative Commons BY-SA',
    hint: 'Comme BY, avec partage aux mêmes conditions.'
  },
  'written-permission': {
    label: "J'ai une autorisation écrite",
    hint: "Tu as l'accord du titulaire des droits."
  }
}
