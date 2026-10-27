import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'
import { FRAMES } from './lib/constructs'
import { serveAssets } from './lib/build/serveAssets'

export default defineConfig({
  // `dist/` (not the hidden default `.output/`) so the browser's folder picker can select dist/chrome-mv3.
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Bianca: Gray Raven Companion',
    description: 'Side panel companion for Bianca in Punishing: Gray Raven: 3D models, animations and voice lines.',
    permissions: ['sidePanel'],
    action: { default_title: 'Open viewer' },
  },
  hooks: {
    'build:done': (wxt) => {
      for (const frame of FRAMES) {
        serveAssets({
          root: wxt.config.root,
          outDir: wxt.config.outDir,
          constructId: frame.id,
          servedPaths: frame.servedPaths,
          mode: 'symlink',
        })
      }
    },
  },
  webExt: { disabled: true },
})
