/**
 * `window.telmi` factice : de quoi faire vivre l'interface sans processus
 * principal, pour la capturer. A garder en accord avec src/preload/index.ts —
 * sinon l'apercu montre autre chose que l'application.
 */
const { contextBridge } = require('electron')
const ETAT = process.env.ETAT_TEST || 'anonymous'

const code = {
  deviceCode: 'secret',
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5
}

let poserCode = null

contextBridge.exposeInMainWorld('telmi', {
  library: { list: async () => ({ ok: true, value: [] }) },
  files: {
    pickAudios: async () => ({ ok: true, value: [] }),
    pickImage: async () => ({ ok: true, value: [] }),
    admit: async () => ({ ok: true, value: [] }),
    fetch: async () => ({ ok: false, error: { code: 'url/invalid', url: '' } }),
    pathOf: () => ''
  },
  auth: {
    restore: async () =>
      ETAT === 'signedIn'
        ? { ok: true, value: { identity: { login: 'famaridon', name: 'Florent' }, scopes: ['public_repo'] } }
        : { ok: true, value: null },
    signIn: async () => new Promise(() => {}),
    cancel: async () => ({ ok: true, value: undefined }),
    signOut: async () => ({ ok: true, value: undefined }),
    openVerification: async () => ({ ok: true, value: undefined })
  },
  on: (canal, rappel) => {
    if (canal === 'auth:code') poserCode = rappel
    return () => {}
  },
  fileUrl: (id) => 'about:blank#' + id
})

// En etat « waiting », on pousse le code juste apres le montage.
if (ETAT === 'waiting') {
  setTimeout(() => poserCode && poserCode(code), 400)
}
