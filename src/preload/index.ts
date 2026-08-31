import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Channel, EventChannel, Events, Params, Result, ResultOf } from '@shared/ipc'
import { CHANNELS, EVENT_CHANNELS, FILE_SCHEME } from '@shared/ipc'
import type { FileKind } from '@shared/types'

/**
 * The single bridge between the interface and the system. We do not expose
 * `ipcRenderer` but functions that reject any channel absent from the contract,
 * so the interface cannot invent a call.
 */
const invoke = async <C extends Channel>(channel: C, params?: Params<C>): Promise<Result<ResultOf<C>>> => {
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    return { ok: false, error: { code: 'ipc/unknown-channel', message: 'Appel refusé.', detail: channel } }
  }
  return (await ipcRenderer.invoke(channel, params)) as Result<ResultOf<C>>
}

const api = {
  library: {
    list: () => invoke('library:list')
  },

  files: {
    pickAudios: () => invoke('files:pick', { kind: 'audio', multiple: true }),
    pickImage: () => invoke('files:pick', { kind: 'image', multiple: false }),
    describe: (paths: string[], kind: FileKind) => invoke('files:describe', { paths, kind }),
    download: (url: string, kind: FileKind) => invoke('files:download', { url, kind }),

    /**
     * Path of a dropped file. `webUtils` is the only way since Electron removed
     * `File.path`, and it has to be called from here.
     */
    pathOf: (file: File) => webUtils.getPathForFile(file)
  },

  /** Subscribes to an event pushed by the main process. Returns an unsubscribe. */
  on: <C extends EventChannel>(channel: C, callback: (data: Events[C]) => void): (() => void) => {
    if (!(EVENT_CHANNELS as readonly string[]).includes(channel)) return () => {}
    const listener = (_e: unknown, data: Events[C]): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.off(channel, listener)
  },

  /** URL to give an <img> or an <audio> for an allowed file. */
  fileUrl: (id: string) => `${FILE_SCHEME}://local/${id}`
} as const

export type TelmiApi = typeof api

contextBridge.exposeInMainWorld('telmi', api)
