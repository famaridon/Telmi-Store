import { describe, expect, it } from 'vitest'
import { acceptsExtension, acceptsMimeType, extensionOf, nameForDownload } from '@domain/rules/files'

describe('extensionOf', () => {
  it('lower-cases and drops the dot', () => {
    expect(extensionOf('Piste.MP3')).toBe('mp3')
    expect(extensionOf('a/b/c.JpEg')).toBe('jpeg')
  })

  it('rends an empty string when there is nothing to read', () => {
    expect(extensionOf('sans-extension')).toBe('')
    expect(extensionOf('.cache')).toBe('')
  })
})

describe('acceptsExtension', () => {
  it('accepts only mp3 as audio', () => {
    expect(acceptsExtension('piste.mp3', 'audio')).toBe(true)
    expect(acceptsExtension('piste.wav', 'audio')).toBe(false)
    expect(acceptsExtension('piste.jpg', 'audio')).toBe(false)
  })

  it('accepts the usual image formats', () => {
    for (const name of ['a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.gif', 'a.avif']) {
      expect(acceptsExtension(name, 'image')).toBe(true)
    }
    expect(acceptsExtension('a.bmp', 'image')).toBe(false)
  })
})

describe('acceptsMimeType', () => {
  it('lets an unannounced type through rather than guessing', () => {
    expect(acceptsMimeType('', 'audio')).toBe(true)
  })

  it('refuses a type that belongs to the other kind', () => {
    expect(acceptsMimeType('audio/mpeg', 'audio')).toBe(true)
    expect(acceptsMimeType('text/html', 'audio')).toBe(false)
    expect(acceptsMimeType('audio/mpeg', 'image')).toBe(false)
  })
})

describe('nameForDownload', () => {
  it('keeps the name from the URL when its extension fits', () => {
    expect(nameForDownload('https://x.fr/contes/le-loup.mp3', 'audio/mpeg', 'audio')).toBe('le-loup.mp3')
  })

  it('ignores the query string', () => {
    expect(nameForDownload('https://x.fr/le-loup.mp3?token=abc', 'audio/mpeg', 'audio')).toBe('le-loup.mp3')
  })

  it('decodes an escaped name', () => {
    expect(nameForDownload('https://x.fr/Le%20Loup.mp3', 'audio/mpeg', 'audio')).toBe('Le Loup.mp3')
  })

  it('borrows the extension from the announced type when the URL has none', () => {
    expect(nameForDownload('https://x.fr/episode/12345', 'audio/mpeg', 'audio')).toBe('12345.mp3')
    expect(nameForDownload('https://x.fr/cover', 'image/png', 'image')).toBe('cover.png')
  })

  it('falls back to a default name when the URL carries none', () => {
    expect(nameForDownload('https://x.fr/', 'audio/mpeg', 'audio')).toBe('telechargement.mp3')
    expect(nameForDownload('https://x.fr', 'audio/mpeg', 'audio')).toBe('telechargement.mp3')
  })

  it('never lets the host name become the file name', () => {
    // Splitting the whole URL string instead of its pathname used to yield
    // « x.mp3 » here, taken straight from the host.
    expect(nameForDownload('https://litteratureaudio.com/', 'audio/mpeg', 'audio')).toBe('telechargement.mp3')
  })

  it('replaces a misleading extension rather than trusting it', () => {
    expect(nameForDownload('https://x.fr/piste.wav', 'audio/mpeg', 'audio')).toBe('piste.mp3')
  })
})
