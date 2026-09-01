/**
 * The shape of a Telmi pack, as measured on a real one that works.
 *
 * See docs/format-pack.md: this is the `FORMAT_TELMI` layout, the one
 * `ConvertFolderTelmi.js` copies verbatim — which is why we build it rather than
 * the looser `FORMAT_AUDIO_LIST`, whose import regenerates the uuid and resets
 * the version, breaking update detection for good.
 */

/** Written to metadata.json. Field names are Telmi-Sync's, not ours. */
export interface PackMetadata {
  title: string
  uuid: string
  /** Always 'cover.png'. */
  image: string
  /** Integer >= 1. At 0, no update will ever be offered. */
  version: number
  category: string
  description: string
  age: number
}

/** Where a button leads: an action, and an index inside it. */
export interface NodeTarget {
  action: string
  index: number
}

export interface NodeControl {
  ok: boolean
  home: boolean
  autoplay: boolean
}

export interface Stage {
  /** File name inside images/, or null for no picture. */
  image: string | null
  /** File name inside audios/, or null for silence. */
  audio: string | null
  ok: NodeTarget | null
  home: NodeTarget | null
  control: NodeControl
}

/** Written to nodes.json: the state machine the storyteller runs. */
export interface PackNodes {
  startAction: NodeTarget
  stages: Record<string, Stage>
  actions: Record<string, { stage: string }[]>
}

/** Written to notes.json. Purely documentary, shown in Telmi-Sync's Studio. */
export type PackNotes = Record<string, { title: string; notes: string }>

/** An image the interface has to draw, and where it goes in the pack. */
export interface ImageToDraw {
  /** Path inside the pack, e.g. 'images/m0.png'. */
  path: string
  /** Id of the picked file to draw from. */
  sourceId: string
  width: number
  height: number
  /** Burnt into the image, since nothing says it out loud yet. */
  caption: string | null
  /** e.g. '3/12'. */
  pagination: string | null
}

/** An audio file to copy into the pack, untouched. */
export interface AudioToCopy {
  /** Path inside the pack, e.g. 'audios/s0.mp3'. */
  path: string
  sourceId: string
}

/**
 * Audio the pack needs but the contributor did not provide: the pack title and
 * the menu labels, which the storyteller says out loud.
 *
 * `title.mp3` is one of the four markers, so it cannot simply be left out. Until
 * something records or synthesises these words, the writer puts silence there —
 * a pack that installs and plays, with silent labels. Speaking them is the next
 * stage, and it drops into this list without changing anything else.
 */
export interface AudioToSpeak {
  path: string
  /** The words to say. */
  text: string
}

/** Everything needed to write a pack, decided entirely by the domain. */
export interface PackPlan {
  metadata: PackMetadata
  nodes: PackNodes
  notes: PackNotes
  images: ImageToDraw[]
  audios: AudioToCopy[]
  spoken: AudioToSpeak[]
  /** Base name of the archive, without extension. */
  archiveName: string
}

/** What the writer reports once the archive exists. */
export interface BuiltPack {
  path: string
  sha256: string
  bytes: number
  fileCount: number
}

/** The four files without which `ConvertZip.js` refuses the archive. */
export const MARKERS = ['metadata.json', 'nodes.json', 'title.mp3', 'title.png'] as const

/** Sizes Telmi-Sync produces, and therefore the ones the device expects. */
export const COVER_SIZE = { width: 512, height: 512 } as const
export const STAGE_SIZE = { width: 640, height: 480 } as const
