import { computed, ref, watch, type Ref } from 'vue'
import { withSkinParts } from '~/lib/prefs/prefs'
import { choicesElsewhere, groupMeshes, hasChoicesHere, isMeshShown, partsToSave, type Mesh, type MeshOverride } from '~/lib/viewer/parts'
import { usePreferences } from './usePreferences'
import type { ViewerSession } from './useViewer'

export interface GroupView {
  id: string
  meshes: Mesh[]
  shown: number
  total: number
}

/**
 * Meshes of the shown model and the user's show/hide choices for them. The unsaved choices (`overrides`) are a plain record by node
 * name, kept across skin switches; what is saved for the shown skin (`usePreferences`, by skin id) sits under them. Both are pushed to
 * the viewer, saved first, on every change and for every new session. Unsaved choices start empty on every open: everything is as
 * what is saved for the skin says, else as the animation data says.
 *
 * The list has two parts, as on huaxu: the meshes the current animation state hides (alternate-state copies, switched on at
 * will) and every other mesh, grouped by the model id in its name.
 */
export function useParts(session: Ref<ViewerSession | null>) {
  const { prefs, update, flush, saveError } = usePreferences()
  const overrides = ref<Record<string, MeshOverride>>({})
  /** Meshes of the model that is shown now (a new list per session, so it follows skin switches). */
  const meshes = computed(() => session.value?.viewer.getMeshes() ?? [])
  /** Node names of the shown model's listed meshes. */
  const present = computed<ReadonlySet<string>>(() => new Set(meshes.value.map((m) => m.name)))
  /** What is saved for the shown skin, by node name. */
  const saved = computed<Record<string, MeshOverride>>(() => {
    const id = session.value?.skin.id
    return (id !== undefined && prefs.value.skins[id]?.parts) || {}
  })
  const hasSaved = computed(() => Object.keys(saved.value).length > 0)
  /** What is saved with the user's unsaved choices on top: what the switches show. */
  const choices = computed(() => ({ ...saved.value, ...overrides.value }))
  /** Nodes the manifest hides in the current state; follows clip, context and skin changes. */
  const stateHidden = ref<ReadonlySet<number>>(new Set())

  watch(
    session,
    (current, _before, onCleanup) => {
      stateHidden.value = new Set(current?.viewer.getStateHidden() ?? [])
      if (!current) return
      onCleanup(current.viewer.onStateHidden((hidden) => (stateHidden.value = new Set(hidden))))
    },
    { immediate: true },
  )
  // Saved choices go in with the session, in the same tick the model is shown, so a hidden mesh is never drawn.
  watch(
    [session, overrides, saved],
    () => session.value?.viewer.setMeshOverrides({ ...saved.value, ...overrides.value }),
    { immediate: true },
  )

  const isShown = (mesh: Mesh): boolean => isMeshShown(mesh, stateHidden.value, choices.value)

  /** Meshes the current state hides, in node order. */
  const stateMeshes = computed(() => meshes.value.filter((m) => stateHidden.value.has(m.index)).sort((a, b) => a.index - b.index))
  const groups = computed<GroupView[]>(() =>
    groupMeshes(meshes.value.filter((m) => !stateHidden.value.has(m.index))).map((g) => ({
      id: g.id,
      meshes: g.meshes,
      shown: g.meshes.filter(isShown).length,
      total: g.meshes.length,
    })),
  )
  /** Any unsaved choice at all, for names this model lacks too (what Reset drops). */
  const anyChanged = computed(() => Object.keys(overrides.value).length > 0)
  /** An unsaved choice that changes this model (what Save would store). */
  const canSave = computed(() => hasChoicesHere(overrides.value, present.value, saved.value))

  /** Set a choice, or drop it when it is what the skin already shows without it (what is saved). */
  function choose(next: Record<string, MeshOverride>, mesh: Mesh, choice: MeshOverride): void {
    if (saved.value[mesh.name] === choice) delete next[mesh.name]
    else next[mesh.name] = choice
  }

  function toggle(mesh: Mesh): void {
    const next = { ...overrides.value }
    choose(next, mesh, isShown(mesh) ? 'hide' : 'show')
    overrides.value = next
  }

  /**
   * A whole model-id group: hide all of it (its alternate-state copies too, so a clip's swap cannot bring it back), or, when
   * something in it is hidden, show every listed mesh of it: the choices for it are dropped, so it follows the animation data
   * again, except where what is saved keeps a listed mesh hidden, which gets `show`.
   */
  function toggleGroup(id: string): void {
    const group = groups.value.find((g) => g.id === id)
    if (!group) return
    const next = { ...overrides.value }
    if (group.shown === group.total) {
      for (const mesh of meshes.value) if (mesh.group === id) choose(next, mesh, 'hide')
    } else {
      for (const mesh of meshes.value) {
        if (mesh.group !== id) continue
        delete next[mesh.name]
        if (group.meshes.includes(mesh) && saved.value[mesh.name] === 'hide') next[mesh.name] = 'show'
      }
    }
    overrides.value = next
  }

  /** Back to what is saved for the skin (else what the animation data says), including unsaved choices for names the shown skin lacks. */
  function reset(): void {
    overrides.value = {}
  }

  /**
   * Keep the shown state for this skin (`partsToSave`). Its unsaved choices are cleared, since they are what is saved now; those for
   * names this model lacks stay for the models that have them. False when the write did not stick (they stay shown for the session).
   */
  function save(): boolean {
    const id = session.value?.skin.id
    if (id === undefined) return false
    const next = partsToSave(saved.value, overrides.value, present.value)
    update((p) => withSkinParts(p, id, next))
    overrides.value = choicesElsewhere(overrides.value, present.value)
    return flush()
  }

  /**
   * Remove what is saved for this skin only; it goes back to the animation data, and so do its unsaved choices
   * (those for names this model lacks stay for the models that have them).
   */
  function forgetSaved(): boolean {
    const id = session.value?.skin.id
    if (id === undefined) return false
    update((p) => withSkinParts(p, id, null))
    overrides.value = choicesElsewhere(overrides.value, present.value)
    return flush()
  }

  return { meshes, stateMeshes, groups, anyChanged, canSave, hasSaved, saveError, isShown, toggle, toggleGroup, reset, save, forgetSaved }
}

export type PartsApi = ReturnType<typeof useParts>
