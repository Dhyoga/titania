<script setup lang="ts">
import type { ViewerStatus } from '~/composables/useViewer'

defineProps<{ status: ViewerStatus; progress: number | null; error: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="status !== 'ready'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
    <template v-if="status === 'loading'">
      <div role="status" class="flex flex-col items-center gap-3">
        <span class="size-8 animate-spin rounded-full border-2 border-surface/30 border-t-surface" aria-hidden="true" />
        <p class="text-sm font-medium text-surface">
          Loading model<template v-if="progress !== null"> · {{ progress }}%</template>
        </p>
      </div>
    </template>
    <template v-else>
      <p role="alert" class="max-w-full break-words text-sm text-surface">{{ error }}</p>
      <button
        type="button"
        class="rounded-button bg-surface px-4 py-2 text-sm font-medium text-text"
        @click="$emit('retry')"
      >
        Retry
      </button>
    </template>
  </div>
</template>
