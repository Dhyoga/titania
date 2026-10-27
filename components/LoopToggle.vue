<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{ disabled?: boolean }>()
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    class="flex size-9 shrink-0 items-center justify-center rounded-button border border-border transition-colors disabled:opacity-40"
    :class="on ? 'border-accent/40 bg-accent/20 text-accent' : 'bg-surface-2 text-text-muted'"
    :aria-pressed="on"
    :disabled="disabled"
    aria-label="Loop"
    title="Loop (L)"
    @click="on = !on"
  >
    <Icon name="repeat" class="size-5" />
  </button>
</template>
