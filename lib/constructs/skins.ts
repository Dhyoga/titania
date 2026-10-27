// Skins of a construct: groups, asset paths and placeholder initials. Pure TypeScript, tested in Node.
import { CHIBI_WIDTH_SHARE, PERSON_WIDTH_SHARE } from '../viewer/framing.ts'

export type SkinGroup = 'generic' | 'coating' | 'chibi'

export interface SkinConfig {
  /** Model file stem: `models/<id>.glb`; also the icon's name. */
  id: string
  name: string
  group: SkinGroup
  /** Path of the skin's animation manifest under `/<constructId>/`, or null for a model without clips (the chibi). */
  manifest: string | null
}

export interface SkinAssets {
  /** Path of the GLB under `/<constructId>/`. */
  modelPath: string
  /** Path of the manifest under `/<constructId>/`, or null. */
  manifestPath: string | null
  /** Path of the thumbnail under `/<constructId>/`; it may not exist (the tile then shows a placeholder). */
  iconPath: string
}

const GROUP_LABELS: Record<SkinGroup, string> = { generic: 'GENERIC', coating: 'COATINGS', chibi: 'CHIBI' }

export function findSkin(skins: readonly SkinConfig[], id: string): SkinConfig {
  const skin = skins.find((s) => s.id === id)
  if (!skin) throw new Error(`Unknown skin: ${id}`)
  return skin
}

export function skinAssets(skin: SkinConfig): SkinAssets {
  return { modelPath: `models/${skin.id}.glb`, manifestPath: skin.manifest, iconPath: `icons/${skin.id}.webp` }
}

/**
 * Share of the bounds' width that the default framing's width limit uses for a skin: a chibi's bounds are its body, a person's are
 * an A-pose that is wider than the silhouette (see `PERSON_WIDTH_SHARE`).
 */
export function skinWidthShare(skin: SkinConfig): number {
  return skin.group === 'chibi' ? CHIBI_WIDTH_SHARE : PERSON_WIDTH_SHARE
}

/** Runs of consecutive skins of the same group, in list order, with the label the strip writes before them. */
export function skinGroups(skins: readonly SkinConfig[]): { group: SkinGroup; label: string; skins: SkinConfig[] }[] {
  const groups: { group: SkinGroup; label: string; skins: SkinConfig[] }[] = []
  for (const skin of skins) {
    const last = groups[groups.length - 1]
    if (last && last.group === skin.group) last.skins.push(skin)
    else groups.push({ group: skin.group, label: GROUP_LABELS[skin.group], skins: [skin] })
  }
  return groups
}

/** Up to two letters for a placeholder tile: the first letters of the first two words (`Thorns of Crimson` → `TC`). */
export function initials(name: string): string {
  const words = name.split(/[\s-]+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !['of', 'the', 'and'].includes(w.toLowerCase()))
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase())
  return letters.join('') || '?'
}
