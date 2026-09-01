import { describe, expect, it } from 'vitest'
import { byLanguage, readDirectory, storeToUse } from '@domain/rules/directory'

const FILE = {
  stores: [
    { depot: 'famaridon/telmi-store-dev', nom: 'Store Dev', langue: 'fr', description: 'Banc d’essai.' },
    { depot: 'heuzef/telmi-store-en', nom: 'Telmi EN', langue: 'en', description: '', index: 'https://x.fr/i.json' }
  ]
}

describe('readDirectory — tolerant on purpose', () => {
  it('reads the entries a directory declares', () => {
    expect(readDirectory(FILE)).toEqual([
      {
        repo: 'famaridon/telmi-store-dev',
        name: 'Store Dev',
        language: 'fr',
        description: 'Banc d’essai.',
        indexUrl: 'https://raw.githubusercontent.com/famaridon/telmi-store-dev/main/index.json'
      },
      {
        repo: 'heuzef/telmi-store-en',
        name: 'Telmi EN',
        language: 'en',
        description: '',
        indexUrl: 'https://x.fr/i.json'
      }
    ])
  })

  it('accepts a bare array as well as a wrapped one', () => {
    expect(readDirectory(FILE.stores)).toHaveLength(2)
  })

  it('drops a malformed entry rather than breaking the screen', () => {
    // The directory is a file anyone can propose a change to: a typo must cost
    // one missing line, not a blank application.
    const listings = readDirectory({
      stores: [
        { depot: 'pas-un-depot' },
        { depot: 'https://github.com/moi/x' },
        { nom: 'sans depot' },
        'une chaine',
        null,
        FILE.stores[0]
      ]
    })
    expect(listings.map((l) => l.repo)).toEqual(['famaridon/telmi-store-dev'])
  })

  it('keeps the first of two entries naming the same store', () => {
    const listings = readDirectory({
      stores: [FILE.stores[0], { ...FILE.stores[0], nom: 'un doublon' }]
    })
    expect(listings).toHaveLength(1)
    expect(listings[0]?.name).toBe('Store Dev')
  })

  it('falls back to the repository name when no name is given', () => {
    expect(readDirectory({ stores: [{ depot: 'moi/mon-store' }] })[0]?.name).toBe('moi/mon-store')
  })

  it('rends nothing for nothing, rather than throwing', () => {
    expect(readDirectory(null)).toEqual([])
    expect(readDirectory({})).toEqual([])
    expect(readDirectory('pas du tout')).toEqual([])
  })
})

describe('byLanguage', () => {
  it('groups by language, languages in order, stores by name', () => {
    const groups = byLanguage(
      readDirectory({
        stores: [
          { depot: 'a/z-store', nom: 'Zèbre', langue: 'fr' },
          { depot: 'a/a-store', nom: 'Abeille', langue: 'fr' },
          { depot: 'b/en-store', nom: 'English', langue: 'en' }
        ]
      })
    )
    expect(groups.map((g) => g.language)).toEqual(['en', 'fr'])
    expect(groups[1]?.stores.map((s) => s.name)).toEqual(['Abeille', 'Zèbre'])
  })

  it('gathers the stores that declare no language, and puts them last', () => {
    const groups = byLanguage(readDirectory({ stores: [{ depot: 'a/x' }, { depot: 'b/y', langue: 'fr' }] }))
    expect(groups.map((g) => g.language)).toEqual(['fr', ''])
  })
})

describe('storeToUse', () => {
  const listings = readDirectory(FILE)

  it('keeps the store that was chosen', () => {
    expect(storeToUse(listings, 'heuzef/telmi-store-en')).toBe('heuzef/telmi-store-en')
  })

  it('falls back to the first when the chosen one has left the directory', () => {
    // A store that disappears must not leave the application aiming at nothing.
    expect(storeToUse(listings, 'quelqu-un/disparu')).toBe('famaridon/telmi-store-dev')
  })

  it('takes the first when nothing was chosen yet', () => {
    expect(storeToUse(listings, null)).toBe('famaridon/telmi-store-dev')
  })

  it('rends nothing when the directory is empty', () => {
    expect(storeToUse([], 'moi/x')).toBeNull()
  })
})
