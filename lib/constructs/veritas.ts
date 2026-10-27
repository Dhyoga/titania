import type { ConstructConfig } from './index.ts'

// Bianca: Veritas. Skin names and groups come from the coatings of the huaxu page saved in data/veritas/wiki/voices.html.
// Its clip folder is `Base Layer` (with a space); asset URLs are encoded for that (lib/assetPath.ts).
export const veritas: ConstructConfig = {
  id: 'veritas',
  displayName: 'Veritas',
  servedPaths: ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r3biankamd010031',
  animationSource: {
    manifest: 'anim/manifest.json',
    // The Generic `BoardAct1005` holds the hand 20 cm off the hip (around the coat); Ink-lit Hermit's rests on it (15.5 cm on Crepuscule).
    extras: [{ manifest: 'anim-skins/r3biankamd019141/manifest.json', label: 'Ink-lit Hermit', clips: ['BoardAct1005'], replace: true }],
  },
  skins: [
    { id: 'r3biankamd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' },
    { id: 'r3biankamd010021', name: 'Generic - Modified', group: 'generic', manifest: 'anim-skins/r3biankamd010021/manifest.json' },
    { id: 'r3biankamd010031', name: 'Generic - Final', group: 'generic', manifest: 'anim-skins/r3biankamd010031/manifest.json' },
    { id: 'r3biankamd019101', name: 'Pact of Zero', group: 'coating', manifest: 'anim-skins/r3biankamd019101/manifest.json' },
    { id: 'r3biankamd019131', name: 'Spring Huntress', group: 'coating', manifest: 'anim-skins/r3biankamd019131/manifest.json' },
    { id: 'r3biankamd019141', name: 'Ink-lit Hermit', group: 'coating', manifest: 'anim-skins/r3biankamd019141/manifest.json' },
    { id: 'r3biankamd019191', name: 'Grace', group: 'coating', manifest: 'anim-skins/r3biankamd019191/manifest.json' },
    { id: 'qr3biankamd010011_chibi', name: 'Chibi', group: 'chibi', manifest: null },
  ],
}
