// Which model Display mode shows. Pure TypeScript, tested in Node.
import type { LobbyPrefs } from '../prefs/prefs.ts'
import type { ConstructConfig } from './index.ts'
import type { SkinConfig } from './skins.ts'

/** A model to show: a frame and one of its skins, by id. */
export interface ModelChoice {
  frame: string
  skin: string
}

/** The skins Display can show: all but the dorm chibis, which have no clips. */
export function displaySkins(frame: ConstructConfig): SkinConfig[] {
  return frame.skins.filter((s) => s.group !== 'chibi')
}

/**
 * The saved Display model, or the default frame's default skin when the saved ids name no frame, no skin of that frame, or a chibi
 * (a record from before a skin was renamed, or edited by hand). A saved frame without a usable skin gives that frame's default skin.
 */
export function resolveDisplayModel(frames: readonly ConstructConfig[], lobby: Pick<LobbyPrefs, 'frame' | 'skin'>, defaultFrame: string): ModelChoice {
  const fallback = frames.find((f) => f.id === defaultFrame) ?? frames[0]
  if (!fallback) throw new Error('No frames to show')
  const frame = frames.find((f) => f.id === lobby.frame)
  if (!frame) return { frame: fallback.id, skin: fallback.defaultSkin }
  const skin = displaySkins(frame).find((s) => s.id === lobby.skin)
  return { frame: frame.id, skin: skin?.id ?? frame.defaultSkin }
}
