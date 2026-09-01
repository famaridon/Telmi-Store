import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { glob } from 'node:fs/promises'

/**
 * The layering, enforced.
 *
 * A convention nobody checks decays within a month. These tests read the import
 * statements of every source file and fail on a forbidden dependency, so the
 * direction of the arrows is a build error rather than a code-review argument.
 *
 * It has earned its place several times: a French comment left in an adapter, a
 * default label written in the domain, and a release body composed in the
 * application layer were all caught here rather than in review.
 */

const sourcesOf = async (pattern: string): Promise<string[]> => {
  const found: string[] = []
  for await (const path of glob(pattern)) found.push(path)
  return found.sort()
}

/** Every module specifier a file imports from, `import type` included. */
const importsOf = (path: string): string[] => {
  const code = readFileSync(path, 'utf8')
  const specifiers: string[] = []
  const patterns = [
    /^\s*import\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /\bfrom\s+['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm
  ]
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specifiers.push(match[1]!)
  }
  return [...new Set(specifiers)]
}

interface Rule {
  layer: string
  pattern: string
  forbidden: { specifier: RegExp; why: string }[]
}

const NODE = { specifier: /^node:|^fs$|^path$|^os$|^crypto$|^stream$|^http$/, why: 'Node' }
const ELECTRON = { specifier: /^electron$/, why: 'Electron' }
const REACT = { specifier: /^react$|^react-dom/, why: 'React' }
const INFRA = { specifier: /^@infra\//, why: 'an adapter' }
const APP = { specifier: /^@app\//, why: 'the application layer' }
const SHARED = { specifier: /^@shared\//, why: 'the transport contract' }
const RENDERER = { specifier: /^@renderer\/|^\.\.\/renderer/, why: 'the interface' }

const RULES: Rule[] = [
  {
    layer: 'domain',
    pattern: 'src/domain/**/*.ts',
    // The whole point of the domain: it depends on nothing.
    forbidden: [NODE, ELECTRON, REACT, INFRA, APP, SHARED, RENDERER]
  },
  {
    layer: 'application',
    pattern: 'src/application/**/*.ts',
    // Use cases orchestrate the domain through its ports, never an adapter.
    forbidden: [NODE, ELECTRON, REACT, INFRA, RENDERER]
  },
  {
    layer: 'shared (contract)',
    pattern: 'src/shared/**/*.ts',
    forbidden: [NODE, ELECTRON, REACT, INFRA, APP, RENDERER]
  },
  {
    layer: 'renderer',
    pattern: 'src/renderer/**/*.{ts,tsx}',
    // The interface talks to the system only through the preload bridge.
    forbidden: [NODE, ELECTRON, INFRA, APP]
  },
  {
    layer: 'infrastructure',
    pattern: 'src/infrastructure/**/*.ts',
    forbidden: [REACT, RENDERER]
  }
]

describe.each(RULES)('$layer', ({ layer, pattern, forbidden }) => {
  it('has files to check', async () => {
    expect((await sourcesOf(pattern)).length).toBeGreaterThan(0)
  })

  it('imports nothing it is forbidden to', async () => {
    const offences: string[] = []
    for (const path of await sourcesOf(pattern)) {
      for (const specifier of importsOf(path)) {
        for (const rule of forbidden) {
          if (rule.specifier.test(specifier)) {
            offences.push(`${relative('.', path)} importe « ${specifier} » (${rule.why})`)
          }
        }
      }
    }
    expect(offences, `${layer}: ${offences.length} forbidden dependency(ies)`).toEqual([])
  })
})

describe('language', () => {
  it('leaves no French text outside the interface', async () => {
    // Code is English, user-facing text is French, and the latter lives only in
    // src/renderer. An accented sentence anywhere else is a presentation concern
    // that leaked into another layer.
    const accented = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/
    const offences: string[] = []
    for (const path of await sourcesOf('src/**/*.{ts,tsx}')) {
      if (path.includes('src/renderer/')) continue
      const lines = readFileSync(path, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (accented.test(line)) offences.push(`${relative('.', path)}:${i + 1} — ${line.trim()}`)
      })
    }
    expect(offences).toEqual([])
  })
})

describe('composition root', () => {
  it('is the only place that instantiates adapters', async () => {
    const wiring: string[] = []
    for (const path of await sourcesOf('src/**/*.{ts,tsx}')) {
      if (path.endsWith('src/main/index.ts')) continue
      const code = readFileSync(path, 'utf8')
      // `createFsFileVault(...)` and friends are factories: calling one outside
      // the composition root means a layer chose its own implementation.
      if (/\bcreate(Fs|Http|Electron)[A-Z]\w*\s*\(/.test(code)) wiring.push(relative('.', path))
    }
    expect(wiring).toEqual([])
  })
})
