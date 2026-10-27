<script setup lang="ts">
// Display's camera is locked; while adjusting, the camera takes input as in Playground and this bar saves or drops the change.
defineProps<{ saveError: boolean }>()
const emit = defineEmits<{ save: []; useBuiltIn: []; cancel: [] }>()

const button = 'flex-1 rounded-button border border-border bg-surface-2 px-2 py-2 text-xs font-semibold text-text'
</script>

<template>
  <div class="pointer-events-auto rounded-card border border-border bg-surface/90 p-2 text-text shadow-lg backdrop-blur-sm" role="group" aria-label="Adjust camera">
    <p class="px-1 pb-1.5 text-xs text-text-muted">Drag, scroll or pinch to frame the model, then save.</p>
    <div class="flex gap-2">
      <button type="button" class="flex-1 rounded-button bg-accent px-2 py-2 text-xs font-semibold text-accent-fg" data-adjust-save @click="emit('save')">Save</button>
      <button type="button" :class="button" @click="emit('useBuiltIn')">Use built-in</button>
      <button type="button" :class="button" @click="emit('cancel')">Cancel</button>
    </div>
    <p v-if="saveError" role="alert" class="px-1 pt-1.5 text-xs text-red-400">Could not save: storage is unavailable. The view lasts until the panel closes.</p>
  </div>
</template>
