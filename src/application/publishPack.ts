import { fail, ok, type Result } from '@domain/errors'
import type { Ports, ProgressReport } from '@domain/ports'
import type { Published, PublishRequest } from '@domain/publish'
import { buildEntry, entrySlug, releaseFileName, releaseTag } from '@domain/rules/entry'

/**
 * Publishing the pack, and building the entry that will point at it.
 *
 * The pack lands in a repository the CONTRIBUTOR owns — the store never hosts a
 * byte of it — so what comes back is an address, and that address goes into the
 * entry a moderator will read.
 *
 * Every step is resumable. An upload of two hundred mega-octets fails often
 * enough that a second attempt is the normal case, not the exception: it must
 * find its own leftovers and replace them rather than pile up duplicates.
 */
export const publishPack = async (
  ports: Ports,
  request: PublishRequest,
  onProgress: ProgressReport
): Promise<Result<Published>> => {
  const token = await ports.tokens.read()
  if (!token.ok) return token
  if (token.value === null) return fail({ code: 'auth/no-session' })

  const slug = entrySlug(request.submission.title)
  const tag = releaseTag(slug, request.version)
  const fileName = releaseFileName(slug)

  const repo = await ports.repos.ensureRepo(token.value, slug, request.submission.title)
  if (!repo.ok) return repo

  // Facts, not prose: the body carries what someone landing on the release needs
  // to check, and no sentence — which also keeps French out of this layer.
  const releaseId = await ports.repos.ensureRelease(
    token.value,
    repo.value,
    tag,
    [
      request.submission.title,
      '',
      `sha256: ${request.pack.sha256}`,
      `octets: ${request.pack.bytes}`,
      '',
      'Telmi Store'
    ].join('\n')
  )
  if (!releaseId.ok) return releaseId

  const asset = await ports.repos.putAsset(
    token.value,
    repo.value,
    releaseId.value,
    fileName,
    request.pack.path,
    onProgress
  )
  if (!asset.ok) return asset

  // Say the pack is published only once the world can actually fetch it.
  const reachable = await ports.repos.checkPublic(asset.value.url, request.pack.bytes)
  if (!reachable.ok) return reachable

  const entry = buildEntry(
    request.submission,
    { uuid: request.uuid, version: request.version, declaredBy: `@${request.login}` },
    {
      kind: 'release',
      repo: repo.value,
      tag,
      file: fileName,
      sha256: request.pack.sha256,
      bytes: request.pack.bytes
    }
  )

  return ok({ entry, url: asset.value.url, repo: repo.value, tag })
}
