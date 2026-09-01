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

  moderate: {
    allowed: async () => ({ ok: true, value: true }),
    awaiting: async () => ({
      ok: true,
      value: [
        {
          number: 15, url: '#', title: 'Comptines du matin (3+)', author: 'une-institutrice',
          at: '2026-08-28T09:00:00Z',
          changed: ['histoires/comptines-du-matin.json', 'vignettes/comptines-du-matin.png'],
          comments: [],
          entry: {
            slug: 'comptines-du-matin', title: 'Comptines du matin', minAge: 3,
            category: 'Comptines', language: 'fr',
            description: 'Douze comptines pour le reveil, enregistrees dans ma classe de petite section.',
            uuid: 'fffffc-1', version: 1,
            rights: { status: 'own-work', source: 'enregistre par moi-meme dans ma classe', declaredBy: '@une-institutrice' },
            pack: { kind: 'release', repo: 'une-institutrice/comptines-du-matin', tag: 'comptines-du-matin-1.0.0', file: 'comptines-du-matin.zip', sha256: 'b'.repeat(64), bytes: 41_200_000 }
          }
        },
        {
          number: 16, url: '#', title: 'Contes russes (6+)', author: 'un-passant',
          at: '2026-08-31T15:00:00Z',
          changed: ['histoires/contes-russes.json', 'vignettes/contes-russes.png', '.github/workflows/valider.yml'],
          comments: [{ author: 'dantsu', body: 'Peux-tu preciser la licence ?', at: '2026-09-01T08:00:00Z' }],
          entry: {
            slug: 'contes-russes', title: 'Contes russes', minAge: 6,
            category: 'Contes', language: 'fr',
            description: 'Trouves sur internet.',
            uuid: 'fffffc-2', version: 1,
            rights: { status: 'public-domain', source: '', declaredBy: '@un-passant' },
            pack: { kind: 'release', repo: 'un-passant/contes-russes', tag: 'contes-russes-1.0.0', file: 'contes-russes.zip', sha256: 'c'.repeat(64), bytes: 210_000_000 }
          }
        }
      ]
    }),
    listen: async () => ({
      ok: true,
      value: {
        title: 'Comptines du matin', question: 'Quelle comptine veux-tu ecouter ?',
        checksumMatches: true,
        chapters: [
          { title: 'Une souris verte', audioId: 'x1' },
          { title: 'Ainsi font font font', audioId: 'x2' },
          { title: 'Dans la foret lointaine', audioId: 'x3' }
        ]
      }
    }),
    accept: async () => ({ ok: true, value: undefined }),
    decline: async () => ({ ok: true, value: undefined })
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

  propose: {
    store: async () => ({ ok: true, value: 'famaridon/telmi-store-dev' }),
    entry: async () => ({
      ok: true,
      value: {
        url: 'https://github.com/famaridon/telmi-store-dev/pull/12',
        number: 12,
        branch: 'proposition/les-contes-de-la-mere-pauline',
        fork: 'famaridon/telmi-store-dev',
        updated: false
      }
    }),
    open: async () => ({ ok: true, value: undefined }),
    mine: async () => ({
      ok: true,
      value: [
        {
          number: 14, url: '#', title: 'Le sorcier Noé et les animaux (5+)',
          storeRepo: 'famaridon/telmi-store-dev', slug: 'le-sorcier-noe',
          state: 'changes-requested', at: '2026-09-01T10:00:00Z',
          comments: [
            { author: 'dantsu', body: 'Merci ! Deux choses avant de publier.', at: '2026-09-01T09:00:00Z' },
            { author: 'dantsu', body: 'La source des droits pointe vers une page qui n’existe plus, et la piste 3 sature un peu. Tu peux corriger et reproposer ?', at: '2026-09-01T10:00:00Z' }
          ]
        },
        {
          number: 12, url: '#', title: 'Les contes de la mère Pauline (7+)',
          storeRepo: 'famaridon/telmi-store-dev', slug: 'les-contes-de-la-mere-pauline',
          state: 'under-review', at: '2026-08-30T14:00:00Z', comments: []
        },
        {
          number: 9, url: '#', title: 'Cache-cache (3+)',
          storeRepo: 'famaridon/telmi-store-dev', slug: 'cache-cache',
          state: 'accepted', at: '2026-08-21T08:00:00Z',
          comments: [{ author: 'dantsu', body: 'Parfait, mes enfants l’ont reclamee trois fois. Merci !', at: '2026-08-21T08:00:00Z' }]
        },
        {
          number: 6, url: '#', title: 'Comptines du matin (3+)',
          storeRepo: 'famaridon/telmi-store-dev', slug: 'comptines-du-matin',
          state: 'declined', at: '2026-08-12T16:00:00Z',
          comments: [{ author: 'dantsu', body: 'Ces comptines sont sous droits chez leur editeur : je ne peux pas les publier ici.', at: '2026-08-12T16:00:00Z' }]
        }
      ]
    })
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
