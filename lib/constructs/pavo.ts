import type { ConstructConfig } from './index.ts'

// Qu, Pavo frame (prefab `r2qumd010011`): the second source of Erza's motion and voice. One Generic skin, no coatings, chibi or
// `anim-skins/` (design D2 of bootstrap-titania). Her hierarchy is Veritas' and Zero's, and some clips sit in a `Base Layer` folder
// (with a space); asset URLs are encoded for that (lib/assetPath.ts).
export const pavo: ConstructConfig = {
  id: 'pavo',
  displayName: 'Pavo',
  servedPaths: ['models', 'anim', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r2qumd010011',
  animationSource: { manifest: 'anim/manifest.json', extras: [] },
  // The default of Display's Animations popover: Shukra's voiced Board actions and her idle.
  lobby: { actionFrom: ['shukra'], idleFrom: ['shukra'] },
  skins: [{ id: 'r2qumd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' }],
}
