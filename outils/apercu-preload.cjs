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
    // En etat « rempli », le selecteur rend de quoi peupler l'ecran.
    pickAudios: async () => ({
      ok: true,
      value:
        ETAT === 'rempli'
          ? [
              { id: 'a1', name: '01 - Ava et la couronne du pouvoir.mp3', bytes: 13_600_000, from: 'disk' },
              { id: 'a2', name: '02 - Gouzabas.mp3', bytes: 5_900_000, from: 'disk' }
            ]
          : []
    }),
    pickImage: async () => ({
      ok: true,
      value: ETAT === 'rempli' ? [{ id: 'cover', name: 'couverture.jpg', bytes: 504_000, from: 'disk' }] : []
    }),
    admit: async () => ({ ok: true, value: [] }),
    fetch: async () => ({ ok: false, error: { code: 'url/invalid', url: '' } }),
    pathOf: () => ''
  },

  packs: {
    build: async () => ({
      ok: true,
      value: {
        path: '/tmp/les-contes-de-la-mere-pauline.zip',
        sha256: '46ac1cd04418e255e60a266189b3529c150ea18c0f0f8009911b21d777962017',
        bytes: 24_318_442,
        fileCount: 10
      }
    }),
    reveal: async () => ({ ok: true, value: undefined })
  },

  publish: {
    pack: async () => ({
      ok: true,
      value: {
        repo: 'famaridon/les-contes-de-la-mere-pauline',
        tag: 'les-contes-de-la-mere-pauline-1.0.0',
        url: 'https://github.com/famaridon/les-contes-de-la-mere-pauline/releases/download/les-contes-de-la-mere-pauline-1.0.0/les-contes-de-la-mere-pauline.zip',
        entry: {
          slug: 'les-contes-de-la-mere-pauline',
          title: 'Les contes de la mère Pauline',
          minAge: 3,
          category: 'Contes',
          language: 'fr',
          description: 'Cinq contes écrits et lus par Pauline Pucciano.',
          uuid: 'fffffc-19c420b4422',
          version: 1,
          rights: { status: 'public-domain', source: 'https://litteratureaudio.com', declaredBy: '@famaridon' },
          pack: {
            kind: 'release',
            repo: 'famaridon/les-contes-de-la-mere-pauline',
            tag: 'les-contes-de-la-mere-pauline-1.0.0',
            file: 'les-contes-de-la-mere-pauline.zip',
            sha256: '46ac1cd04418e255e60a266189b3529c150ea18c0f0f8009911b21d777962017',
            bytes: 24318442
          }
        }
      }
    })
  },
  auth: {
    restore: async () =>
      ETAT === 'signedIn' || ETAT === 'rempli'
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
  // Une image en data: — autorisee par la CSP — pour que le canvas puisse dessiner
  fileUrl: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAF0lEQVQI12NkYPjPwMDAxMDAwMjAwAAADiwBLYaMEXcAAAAASUVORK5CYII='
})

// En etat « waiting », on pousse le code juste apres le montage.
if (ETAT === 'waiting') {
  setTimeout(() => poserCode && poserCode(code), 400)
}
