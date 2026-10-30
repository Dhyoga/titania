import { erza } from './erza.ts'
import { shukra } from './shukra.ts'
import { pavo } from './pavo.ts'
import type { SkinConfig } from './skins.ts'

export type { SkinConfig, SkinGroup } from './skins.ts'

/**
 * What Display borrows for a frame's model from other frames' Generic clip sets (retargeted as in Playground, with the lender's own
 * voice line) when the user has chosen nothing for that frame: the default of the Animations popover. Any frame can be chosen there;
 * frame ids are from `FRAMES` and a frame never lists itself.
 */
export interface LobbyConfig {
  /** Frames whose voiced Board actions are borrowed by default. */
  actionFrom: string[]
  /** Frames whose idle clips are borrowed by default, at a small weight. */
  idleFrom: string[]
}

export interface ConstructConfig {
  id: string
  displayName: string
  /** Paths under `data/<id>/` that are packaged and served at `/<id>/<path>`. A path missing from data/ is skipped. */
  servedPaths: string[]
  /** Id of the skin shown first (`models/<id>.glb`). */
  defaultSkin: string
  /** Skins in strip order. */
  skins: SkinConfig[]
  /**
   * What the frame lends to the other frames' models: the Generic clip set's manifest and named clips of other clip sets (labelled
   * with their skin). An extra adds clips the Generic set lacks, which the frame's other skins get too; with `replace` it lends its
   * clips in place of the same-named Generic ones and only to other frames. Each set is retargeted from the rig of its manifest's
   * `target` model. Null for a frame with no clip set of its own (Erza): it lends nothing, has no clips, and plays only what the other frames
   * lend it.
   */
  animationSource: { manifest: string; extras: { manifest: string; label: string; clips: string[]; replace?: boolean }[] } | null
  /** False for a frame that Display does not offer (Erza, which has no clips or voice lines of her own): not a Display model, not a lender. */
  display?: false
  /** What Display borrows for this frame's model; none means it keeps to its own clips. */
  lobby?: LobbyConfig
}

/**
 * Erza and Qu's frames, in the order the panel's picker lists them (Qu's are shown only until erza-only-companion). The one place that decides
 * which constructs exist: the panel and the build (`wxt.config.ts`, which serves every one of them) both read it.
 */
export const FRAMES: readonly ConstructConfig[] = [erza, shukra, pavo]

/** The frames Display can show and borrow from: those that have a clip set of their own. */
export const displayFrames = (frames: readonly ConstructConfig[] = FRAMES): ConstructConfig[] => frames.filter((f) => f.display !== false)

/** The frames that lend clips to the shown model: those with a clip set (animation source). */
export const lendingFrames = (frames: readonly ConstructConfig[] = FRAMES): ConstructConfig[] => frames.filter((f) => f.animationSource !== null)

/** The frame the panel opens on. */
export const DEFAULT_FRAME = shukra.id

export function getConstruct(id: string): ConstructConfig {
  const construct = FRAMES.find((f) => f.id === id)
  if (!construct) throw new Error(`Unknown construct: ${id}`)
  return construct
}
