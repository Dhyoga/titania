<script setup lang="ts">
defineProps<{ label: string; /** Muted text after the label, e.g. `× 3`. */ detail?: string }>()
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="on"
    class="flex w-full items-center justify-between gap-3 rounded-button px-1 py-1.5 text-left text-sm text-text"
    @click="on = !on"
  >
    <span class="min-w-0 truncate">{{ label }}<span v-if="detail" class="ml-1.5 text-xs text-text-muted">{{ detail }}</span></span>
    <span class="relative h-5 w-9 shrink-0 rounded-full transition-colors" :class="on ? 'bg-accent' : 'bg-border'" aria-hidden="true">
      <span class="absolute top-0.5 size-4 rounded-full bg-text transition-all" :class="on ? 'left-[18px] bg-accent-fg' : 'left-0.5'" />
    </span>
  </button>
</template>
