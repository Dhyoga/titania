import type { ConstructConfig } from './index.ts'

// Bianca: Stigmata. Skin names and groups come from the coatings of the huaxu page saved in data/stigmata/wiki/voices.html
// (see AGENTS.md, "Skins" and "Other Bianca frames"). The battle chibi `q4biankamd010011` is not offered.
export const stigmata: ConstructConfig = {
  id: 'stigmata',
  displayName: 'Stigmata',
  servedPaths: ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r4biankamd010031',
  // Solitary Dream's two extra Board actions exist only in its own clip set.
  animationSource: {
    manifest: 'anim/manifest.json',
    extras: [{ manifest: 'anim-skins/r4biankamd019241/manifest.json', label: 'Solitary Dream', clips: ['BoardAct10021', 'BoardAct10022'] }],
  },
  skins: [
    { id: 'r4biankamd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' },
    { id: 'r4biankamd010021', name: 'Generic - Modified', group: 'generic', manifest: 'anim-skins/r4biankamd010021/manifest.json' },
    { id: 'r4biankamd010031', name: 'Generic - Final', group: 'generic', manifest: 'anim-skins/r4biankamd010031/manifest.json' },
    { id: 'r4biankamd019011', name: 'Exorcist', group: 'coating', manifest: 'anim-skins/r4biankamd019011/manifest.json' },
    { id: 'r4biankamd019241', name: 'Solitary Dream', group: 'coating', manifest: 'anim-skins/r4biankamd019241/manifest.json' },
    { id: 'r4biankamd019281', name: 'Pyrewatch', group: 'coating', manifest: 'anim-skins/r4biankamd019281/manifest.json' },
    { id: 'qr4biankamd010011_chibi', name: 'Chibi', group: 'chibi', manifest: null },
  ],
}
