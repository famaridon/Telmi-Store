import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Three targets, three bundles. The aliases carry the layering: see
 * docs/archi.md and tests/architecture.test.ts, which enforces it.
 */
const layers = {
  '@domain': resolve('src/domain'),
  '@app': resolve('src/application'),
  '@infra': resolve('src/infrastructure'),
  '@shared': resolve('src/shared')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: layers }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: layers }
  },
  renderer: {
    plugins: [react()],
    // The renderer reaches the domain and the contract, never an adapter.
    resolve: { alias: { ...layers, '@renderer': resolve('src/renderer/src') } }
  }
})
