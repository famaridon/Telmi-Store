import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { fail } from '@domain/errors'
import type { FileKind } from '@domain/model'
import type { Answer, Channel, EventChannel, Events, Params } from '@shared/contract'
import { CHANNELS, EVENT_CHANNELS, FILE_SCHEME } from '@shared/contract'

/**
 * The single bridge between the interface and the system. `ipcRenderer` is never
 * exposed: only functions that reject any channel absent from the contract, so
 * the interface cannot invent a call.
 */
const invoke = async <C extends Channel>(channel: C, params?: Params<C>): Promise<Answer<C>> => {
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    return fail({ code: 'ipc/unknown-channel', channel })
  }
  return (await ipcRenderer.invoke(channel, params)) as Answer<C>
}

const api = {
  library: {
    list: () => invoke('library:list')
  },

  files: {
    pickAudios: () => invoke('files:pick', { kind: 'audio', multiple: true }),
    pickImage: () => invoke('files:pick', { kind: 'image', multiple: false }),
    admit: (paths: string[], kind: FileKind) => invoke('files:admit', { paths, kind }),
    fetch: (url: string, kind: FileKind) => invoke('files:fetch', { url, kind }),

    /**
     * Path of a dropped file. `webUtils` is the only way since Electron removed
     * `File.path`, and it has to be called from here.
     */
    pathOf: (file: File) => webUtils.getPathForFile(file)
  },

  auth: {
    /** Resolves only when the flow is over. The code arrives via `auth:code`. */
    signIn: () => invoke('auth:signIn'),
    cancel: () => invoke('auth:cancel'),
    restore: () => invoke('auth:restore'),
    signOut: () => invoke('auth:signOut'),
    /** Opens the GitHub page of the sign-in under way. Takes no URL. */
    openVerification: () => invoke('auth:openVerification')
  },

  /** Subscribes to an event pushed by the main process. Returns an unsubscribe. */
  on: <C extends EventChannel>(channel: C, callback: (data: Events[C]) => void): (() => void) => {
    if (!(EVENT_CHANNELS as readonly string[]).includes(channel)) return () => {}
    const listener = (_e: unknown, data: Events[C]): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.off(channel, listener)
  },

  /** URL to give an <img> or an <audio> for an admitted file. */
  fileUrl: (id: string) => `${FILE_SCHEME}://local/${id}`
} as const

export type TelmiApi = typeof api

contextBridge.exposeInMainWorld('telmi', api)
