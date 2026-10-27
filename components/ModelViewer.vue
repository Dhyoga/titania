<script setup lang="ts">
import { ref } from 'vue'
import type { ViewerStatus } from '~/composables/useViewer'
import StageStatus from './StageStatus.vue'

defineProps<{ status: ViewerStatus; progress: number | null; error: string }>()
defineEmits<{ retry: [] }>()

// The element the viewer renders into; `ModelTab` hands it to `useViewer`.
const container = ref<HTMLElement | null>(null)
defineExpose({ container })
</script>

<template>
  <div class="absolute inset-0">
    <div ref="container" class="absolute inset-0" />
    <StageStatus :status="status" :progress="progress" :error="error" @retry="$emit('retry')" />
  </div>
</template>
