<script setup lang="ts">
import { reactive } from 'vue'
import type { GroupView } from '~/composables/useParts'
import type { Mesh } from '~/lib/viewer/parts'
import Icon from './Icon.vue'
import SwitchField from './SwitchField.vue'

defineProps<{
  /** Meshes the current animation state hides. */
  stateMeshes: Mesh[]
  groups: GroupView[]
  isShown: (mesh: Mesh) => boolean
  /** There are unsaved choices (Reset drops them, also those for names this model lacks). */
  anyChanged: boolean
  /** An unsaved choice changes this model: one that differs from what is saved for the skin, else from its default form. */
  canSave: boolean
  /** Something is saved for the shown skin. */
  hasSaved: boolean
  /** The last write did not stick (storage unavailable or full). */
  saveError: boolean
}>()
defineEmits<{ toggle: [mesh: Mesh]; toggleGroup: [id: string]; reset: []; save: []; forgetSaved: [] }>()

const button = 'w-full rounded-button border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-40'

/** Groups the user folded; all start open. */
const folded = reactive(new Set<string>())
function fold(id: string): void {
  if (!folded.delete(id)) folded.add(id)
}
</script>

<template>
  <div class="space-y-1">
    <div class="max-h-[min(24rem,calc(100vh-14rem))] space-y-0.5 overflow-y-auto pr-1 [color-scheme:dark]">
      <template v-if="stateMeshes.length">
        <p class="text-xs font-medium text-text">Hidden by this animation</p>
        <SwitchField v-for="mesh in stateMeshes" :key="mesh.index" :model-value="isShown(mesh)" :label="mesh.label" @update:model-value="$emit('toggle', mesh)" />
        <hr class="my-2 border-border" />
      </template>
      <p class="text-xs font-medium text-text">All meshes</p>
      <section v-for="group in groups" :key="group.id" :aria-label="`Model ${group.id}`">
        <div class="flex items-center gap-1">
          <SwitchField
            class="flex-1"
            :model-value="group.shown === group.total"
            :label="group.id"
            :detail="`${group.shown}/${group.total}`"
            @update:model-value="$emit('toggleGroup', group.id)"
          />
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-button text-text-muted"
            :aria-label="folded.has(group.id) ? `Expand ${group.id}` : `Collapse ${group.id}`"
            :aria-expanded="!folded.has(group.id)"
            @click="fold(group.id)"
          >
            <Icon name="chevron-down" class="size-4 transition-transform" :class="folded.has(group.id) && '-rotate-90'" />
          </button>
        </div>
        <div v-show="!folded.has(group.id)" class="space-y-0.5 pl-3">
          <SwitchField v-for="mesh in group.meshes" :key="mesh.index" :model-value="isShown(mesh)" :label="mesh.label" @update:model-value="$emit('toggle', mesh)" />
        </div>
      </section>
    </div>
    <div class="mt-1 grid grid-cols-2 gap-2">
      <button type="button" :class="button" :disabled="!anyChanged" @click="$emit('reset')">Reset</button>
      <button type="button" :class="button" :disabled="!canSave" @click="$emit('save')">Save</button>
    </div>
    <button v-if="hasSaved" type="button" :class="button" @click="$emit('forgetSaved')">Forget saved</button>
    <p v-if="saveError" role="alert" class="text-xs text-red-400">Could not save: storage is unavailable. Changes last until the panel closes.</p>
  </div>
</template>
