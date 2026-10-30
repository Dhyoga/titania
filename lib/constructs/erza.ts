import type { ConstructConfig } from './index.ts'

// Erza Scarlet (`data/erza/source/Erza Scarlet/`, converted by scripts/convert-fbx.ts). She has no clip set and no voice lines of her own:
// every animation she plays is a Shukra or Pavo clip retargeted onto her, with that frame's voice line (add-erza-model, design D3). One skin,
// no icon (the tile shows the initials `ES`). Display does not know her until erza-only-companion (design D4).
export const erza: ConstructConfig = {
  id: 'erza',
  displayName: 'Erza',
  servedPaths: ['models', 'icons'],
  defaultSkin: 'erza-scarlet',
  animationSource: null,
  display: false,
  skins: [{ id: 'erza-scarlet', name: 'Erza Scarlet', group: 'generic', manifest: null }],
}
