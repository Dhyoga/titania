<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

defineProps<{
  /** No model is shown: the camera cannot be saved. */
  disabled: boolean
  /** A default camera is saved. */
  hasCamera: boolean
  /** Display mode's camera is saved (else its built-in bust framing is used). */
  hasDisplayCamera: boolean
  /** How many skins have saved parts. */
  skinCount: number
  /** The last write did not stick (storage unavailable or full). */
  saveError: boolean
  /** Why the last import was refused. */
  importError: string
}>()
const emit = defineEmits<{
  saveCamera: []
  builtInCamera: []
  builtInDisplayCamera: []
  export: []
  import: [file: File]
  forgetAll: []
}>()

const CONFIRM_MS = 3000
const fileInput = ref<HTMLInputElement | null>(null)
/** "Forget all" was pressed once: the next press within `CONFIRM_MS` confirms. */
const confirming = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined

function onForgetAll(): void {
  if (!confirming.value) {
    confirming.value = true
    confirmTimer = setTimeout(() => (confirming.value = false), CONFIRM_MS)
    return
  }
  clearTimeout(confirmTimer)
  confirming.value = false
  emit('forgetAll')
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // the same file can be chosen again
  if (file) emit('import', file)
}

onBeforeUnmount(() => clearTimeout(confirmTimer))

const button = 'w-full rounded-button border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-40'
</script>

<template>
  <div class="space-y-3 text-xs text-text">
    <section class="space-y-1.5" aria-label="Default camera">
      <p class="font-medium">Default camera</p>
      <p class="text-text-muted">{{ hasCamera ? 'Your view is used on open, resize and reset.' : 'The built-in framing is used.' }}</p>
      <button type="button" :class="button" :disabled="disabled" @click="emit('saveCamera')">Save current view as default</button>
      <button type="button" :class="button" :disabled="!hasCamera" @click="emit('builtInCamera')">Use the built-in default</button>
    </section>
    <section class="space-y-1.5" aria-label="Display camera">
      <p class="font-medium">Display camera</p>
      <p class="text-text-muted">{{ hasDisplayCamera ? 'Display uses your saved view.' : 'Display uses the built-in bust framing.' }} Adjust it in Display.</p>
      <button type="button" :class="button" :disabled="!hasDisplayCamera" @click="emit('builtInDisplayCamera')">Use built-in for Display</button>
    </section>
    <section class="space-y-1.5" aria-label="Saved parts">
      <p class="font-medium">Saved parts</p>
      <p class="text-text-muted">
        {{ skinCount === 0 ? 'No skin has saved parts.' : skinCount === 1 ? '1 skin has saved parts.' : `${skinCount} skins have saved parts.` }}
        Save them in the Parts menu.
      </p>
    </section>
    <section class="space-y-1.5" aria-label="Backup">
      <p class="font-medium">Backup</p>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" :class="button" @click="emit('export')">Export</button>
        <button type="button" :class="button" @click="fileInput?.click()">Import</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" tabindex="-1" aria-label="Preferences file" @change="onFile" />
      <p v-if="importError" role="alert" class="break-words text-red-400">{{ importError }}</p>
    </section>
    <button
      type="button"
      :class="[button, confirming && '!border-red-400 !text-red-400']"
      :aria-label="confirming ? 'Press again to forget all preferences' : 'Forget all'"
      @click="onForgetAll"
    >
      {{ confirming ? 'Press again to confirm' : 'Forget all' }}
    </button>
    <p v-if="saveError" role="alert" class="text-red-400">Could not save: storage is unavailable. Changes last until the panel closes.</p>
  </div>
</template>
