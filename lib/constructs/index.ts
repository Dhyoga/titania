import { crepuscule } from './crepuscule.ts'
import { stigmata } from './stigmata.ts'
import { veritas } from './veritas.ts'
import { zero } from './zero.ts'
import type { SkinConfig } from './skins.ts'

export type { SkinConfig, SkinGroup } from './skins.ts'

/**
 * What Display borrows for a frame's model from other frames' Generic clip sets (retargeted as in Playground, with the lender's own
 * voice line) when the user has chosen nothing for that frame: the default of the Animations popover. Any frame, Zero included, can be
 * chosen there; frame ids are from `FRAMES` and a frame never lists itself.
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
   * `target` model.
   */
  animationSource: { manifest: string; extras: { manifest: string; label: string; clips: string[]; replace?: boolean }[] }
  /** What Display borrows for this frame's model; none means it keeps to its own clips. */
  lobby?: LobbyConfig
}

/**
 * Bianca's frames, in the order the panel's picker lists them. The one place that decides which constructs exist: the panel and
 * the build (`wxt.config.ts`, which serves every one of them) both read it.
 */
export const FRAMES: readonly ConstructConfig[] = [crepuscule, stigmata, veritas, zero]

/** The frame the panel opens on. */
export const DEFAULT_FRAME = crepuscule.id

export function getConstruct(id: string): ConstructConfig {
  const construct = FRAMES.find((f) => f.id === id)
  if (!construct) throw new Error(`Unknown construct: ${id}`)
  return construct
}
