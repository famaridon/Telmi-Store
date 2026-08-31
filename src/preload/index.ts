import { contextBridge, ipcRenderer } from 'electron'
import type { Canal, Params, Reponse, Resultat } from '@shared/ipc'
import { CANAUX } from '@shared/ipc'

/**
 * Unique pont entre l'interface et le systeme. On n'expose pas `ipcRenderer`
 * mais une fonction qui refuse tout canal absent du contrat : l'interface ne
 * peut donc pas inventer un appel.
 */
const invoquer = async <C extends Canal>(
  canal: C,
  params?: Params<C>
): Promise<Resultat<Reponse<C>>> => {
  if (!(CANAUX as readonly string[]).includes(canal)) {
    return {
      ok: false,
      erreur: { code: 'ipc/canal-inconnu', message: 'Appel refuse.', details: canal }
    }
  }
  return (await ipcRenderer.invoke(canal, params)) as Resultat<Reponse<C>>
}

const api = {
  bibliotheque: {
    lister: () => invoquer('bibliotheque:lister')
  }
} as const

export type ApiTelmi = typeof api

contextBridge.exposeInMainWorld('telmi', api)
