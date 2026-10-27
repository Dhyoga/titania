import type { ConstructConfig } from './index.ts'

// Bianca: Zero. Skin names and groups come from the coatings of the huaxu page saved in data/zero/wiki/voices.html.
// Like Veritas it keeps its clips in a `Base Layer` folder, and has no `Walk`.
export const zero: ConstructConfig = {
  id: 'zero',
  displayName: 'Zero',
  servedPaths: ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r2biankamd010031',
  animationSource: { manifest: 'anim/manifest.json', extras: [] },
  skins: [
    { id: 'r2biankamd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' },
    { id: 'r2biankamd010021', name: 'Generic - Modified', group: 'generic', manifest: 'anim-skins/r2biankamd010021/manifest.json' },
    { id: 'r2biankamd010031', name: 'Generic - Final', group: 'generic', manifest: 'anim-skins/r2biankamd010031/manifest.json' },
    { id: 'r2biankamd019011', name: 'Gray Feathers: Zero', group: 'coating', manifest: 'anim-skins/r2biankamd019011/manifest.json' },
    { id: 'r2biankamd019071', name: 'Thistle', group: 'coating', manifest: 'anim-skins/r2biankamd019071/manifest.json' },
    { id: 'qr2biankamd010011_chibi', name: 'Chibi', group: 'chibi', manifest: null },
  ],
}
