import type { ConstructConfig } from './index.ts'

// Skin names, groups and icons come from the huaxu page payload saved in data/crepuscule/wiki/voices.html: its
// `__NUXT_DATA__` (Nuxt's devalue format) holds `coatings` (name, generic, icon, model `charaterprefab/<id>`) and
// `chibis` (model `room/prefab/<id>`). AGENTS.md ("Skins") has the table and how to decode it.
export const crepuscule: ConstructConfig = {
  id: 'crepuscule',
  displayName: 'Crepuscule',
  // Paths under data/<id>/ that ship with the extension (see AGENTS.md, "Assets and data/"). `icons` exists once the
  // download script has fetched the thumbnails.
  servedPaths: ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r5biankamd010031', // Generic - Final; the strip keeps its order, only the first pick and the DEFAULT badge move
  animationSource: { manifest: 'anim/manifest.json', extras: [] },
  // Display's lobby borrows Board actions from Stigmata and Veritas and idles from Stigmata (add-lobby-variety).
  lobby: { actionFrom: ['stigmata', 'veritas'], idleFrom: ['stigmata'] },
  skins: [
    { id: 'r5biankamd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json', lightForm: true },
    { id: 'r5biankamd010021', name: 'Generic - Modified', group: 'generic', manifest: 'anim-skins/r5biankamd010021/manifest.json', lightForm: true },
    { id: 'r5biankamd010031', name: 'Generic - Final', group: 'generic', manifest: 'anim-skins/r5biankamd010031/manifest.json', lightForm: true },
    { id: 'r5biankamd019011', name: 'Thorns of Crimson', group: 'coating', manifest: 'anim-skins/r5biankamd019011/manifest.json' },
    { id: 'r5biankamd019241', name: 'Night Sonata', group: 'coating', manifest: 'anim-skins/r5biankamd019241/manifest.json' },
    { id: 'r5biankamd019271', name: 'Sunlit Tides', group: 'coating', manifest: 'anim-skins/r5biankamd019271/manifest.json' },
    { id: 'qr5biankamd010011_chibi', name: 'Chibi', group: 'chibi', manifest: null },
  ],
}
