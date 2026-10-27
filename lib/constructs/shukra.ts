import type { ConstructConfig } from './index.ts'

// Qu, Shukra frame (prefab `r3qumd010011`): the source of Erza's motion and voice. One Generic skin, no coatings, chibi or `anim-skins/`
// (design D2 of bootstrap-titania); she is shown as a frame only until erza-only-companion. Her hierarchy is Crepuscule's minus `Root`.
export const shukra: ConstructConfig = {
  id: 'shukra',
  displayName: 'Shukra',
  servedPaths: ['models', 'anim', 'voices_ja', 'voices.json', 'icons'],
  defaultSkin: 'r3qumd010011',
  animationSource: { manifest: 'anim/manifest.json', extras: [] },
  // The default of Display's Animations popover: Pavo's voiced Board actions and her idle.
  lobby: { actionFrom: ['pavo'], idleFrom: ['pavo'] },
  skins: [{ id: 'r3qumd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' }],
}
