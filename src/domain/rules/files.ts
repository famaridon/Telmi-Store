import type { FileKind } from '../model'

/** What counts as an acceptable file for a Telmi pack. A domain decision. */
export const EXTENSIONS: Record<FileKind, readonly string[]> = {
  audio: ['mp3'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
}

export const MIME_TYPES: Record<FileKind, readonly string[]> = {
  audio: ['audio/mpeg', 'audio/mp3'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
}

/** Lower-cased extension of a file name, without the dot. '' when absent. */
export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

export const acceptsExtension = (name: string, kind: FileKind): boolean =>
  EXTENSIONS[kind].includes(extensionOf(name))

/** An empty type means the server said nothing: we let it through. */
export const acceptsMimeType = (type: string, kind: FileKind): boolean =>
  type === '' || MIME_TYPES[kind].includes(type)

/**
 * A readable file name for a download, derived from the URL path then from the
 * announced type.
 *
 * Pure: the URL is parsed, never fetched. `URL` is a language standard, not a
 * Node dependency — reading the pathname rather than splitting the whole string
 * is what keeps the host name out of the file name.
 */
export const nameForDownload = (url: string, mimeType: string, kind: FileKind): string => {
  let base = 'telechargement'
  let pathname = ''
  try {
    pathname = new URL(url).pathname
  } catch {
    // Not a parseable URL: the default name will do.
  }
  const last = pathname.split('/').filter((segment) => segment !== '').pop()
  if (last !== undefined && last !== '') {
    try {
      base = decodeURIComponent(last)
    } catch {
      base = last
    }
  }
  if (acceptsExtension(base, kind)) return base
  const extension = EXTENSION_BY_MIME[mimeType] ?? EXTENSIONS[kind][0]
  return `${base.replace(/\.[^.]*$/, '')}.${extension}`
}
