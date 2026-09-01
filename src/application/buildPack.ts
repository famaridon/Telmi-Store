import type { Result } from '@domain/errors'
import type { BuiltPack, PackPlan } from '@domain/pack'
import type { PackFile, Ports } from '@domain/ports'

/**
 * Writing the pack.
 *
 * The plan comes from the interface because the interface had to read it anyway
 * to know what to draw; the writer checks that every file the plan names is
 * actually there, so a divergence fails by name instead of producing an archive
 * rejected at import.
 */
export const buildPack = (
  ports: Ports,
  plan: PackPlan,
  files: PackFile[]
): Promise<Result<BuiltPack>> => ports.packs.write(plan, files)
