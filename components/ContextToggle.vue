<script setup lang="ts">
import type { ContextId } from '~/lib/anim/catalog'

defineProps<{ disabled?: boolean }>()
const context = defineModel<ContextId>({ required: true })

const options: { id: ContextId; label: string }[] = [
  { id: 'fight', label: 'Fight' },
  { id: 'menu', label: 'Menu' },
]
</script>

<template>
  <div role="radiogroup" aria-label="Animation set" class="flex rounded-button bg-surface-2 p-0.5">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="context === option.id"
      :disabled="disabled"
      class="rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
      :class="context === option.id ? 'bg-accent text-accent-fg' : 'text-text'"
      @click="context !== option.id && (context = option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
