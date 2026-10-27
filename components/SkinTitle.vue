<script setup lang="ts">
defineProps<{ name: string; isDefault: boolean }>()
</script>

<template>
  <div class="mt-4 flex min-w-0 items-baseline gap-2">
    <h3 class="min-w-0 truncate text-lg font-bold text-text">{{ name }}</h3>
    <span v-if="isDefault" class="shrink-0 text-xs font-bold uppercase tracking-wide text-accent">Default</span>
  </div>
</template>
