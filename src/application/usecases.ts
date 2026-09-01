import type { FileKind, LocalStory, PickedFile } from '@domain/model'
import type { Ports, ProgressReport } from '@domain/ports'
import type { Result } from '@domain/errors'

/**
 * Use cases: what the application does, expressed with ports only.
 *
 * Plain functions taking their dependencies as a first argument — no container,
 * no class per use case. They stay testable with in-memory ports, which is the
 * whole point of the indirection.
 */

export const listLibrary = (ports: Ports): Promise<Result<LocalStory[]>> => ports.library.list()

export const pickFiles = (
  ports: Ports,
  kind: FileKind,
  multiple: boolean
): Promise<Result<PickedFile[]>> => ports.picker.pick(kind, multiple)

/** Admits paths obtained by drag and drop. One rejection fails the batch. */
export const admitPaths = async (
  ports: Ports,
  paths: string[],
  kind: FileKind
): Promise<Result<PickedFile[]>> => {
  const files: PickedFile[] = []
  for (const path of paths) {
    const r = await ports.vault.admit(path, kind)
    if (!r.ok) return r
    files.push(r.value)
  }
  return { ok: true, value: files }
}

export const fetchFromUrl = (
  ports: Ports,
  url: string,
  kind: FileKind,
  onProgress: ProgressReport
): Promise<Result<PickedFile>> => ports.fetcher.fetchInto(url, kind, onProgress)
