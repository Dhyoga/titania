<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { assetUrl } from '~/lib/assets'
import { initials, skinAssets, skinGroups, type SkinConfig, type SkinGroup } from '~/lib/constructs/skins'
import Icon from './Icon.vue'

const props = defineProps<{
  constructId: string
  skins: SkinConfig[]
  /** Id of the skin shown or loading. */
  selected: string
  /** Id of the skin being loaded, if any. */
  loading: string | null
}>()
const emit = defineEmits<{ select: [id: string] }>()

const groups = computed(() => skinGroups(props.skins))
const scroller = ref<HTMLElement | null>(null)
/** Skins whose icon failed to load: they show a placeholder instead. */
const broken = reactive(new Set<string>())
const bar = ref({ overflowing: false, width: '100%', left: '0%' })

const TINT: Record<SkinGroup, string> = {
  generic: 'bg-surface text-text-muted',
  coating: 'bg-accent/15 text-accent',
  chibi: 'bg-surface text-text',
}

const iconUrl = (skin: SkinConfig): string => assetUrl(props.constructId, skinAssets(skin).iconPath)

function tile(id: string): HTMLElement | null {
  return scroller.value?.querySelector<HTMLElement>(`[data-skin="${CSS.escape(id)}"]`) ?? null
}

/** Scroll-progress bar: visible share of the strip and where it is. */
function updateBar(): void {
  const el = scroller.value
  if (!el) return
  const overflowing = el.scrollWidth > el.clientWidth + 1
  bar.value = {
    overflowing,
    width: `${(el.clientWidth / el.scrollWidth) * 100}%`,
    left: `${(el.scrollLeft / el.scrollWidth) * 100}%`,
  }
}

function reveal(id: string): void {
  void nextTick(() => tile(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
}

// Radio-group keys: the arrows move to the previous or next skin and select it (focus follows).
function onKeydown(event: KeyboardEvent): void {
  const ids = props.skins.map((s) => s.id)
  const at = Math.max(0, ids.indexOf(props.selected))
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = Math.min(ids.length - 1, at + 1)
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = Math.max(0, at - 1)
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = ids.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  const id = ids[next]!
  if (id !== props.selected) emit('select', id)
  void nextTick(() => tile(id)?.focus())
}

let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(updateBar)
  if (scroller.value) observer.observe(scroller.value)
  updateBar()
  reveal(props.selected)
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.selected, reveal)

/** Called by ModelTab after Focus off so the selected tile is back in view. */
function revealSelected(): void {
  reveal(props.selected)
}
defineExpose({ revealSelected })
</script>

<template>
  <div class="mt-2">
    <div
      ref="scroller"
      role="radiogroup"
      aria-label="Skins"
      class="flex items-stretch gap-2 overflow-x-auto py-1 [scrollbar-width:none]"
      @scroll="updateBar"
      @keydown="onKeydown"
    >
      <template v-for="group in groups" :key="group.label">
        <span class="shrink-0 rotate-180 select-none self-center text-[10px] font-bold tracking-widest text-text-muted [writing-mode:vertical-rl]" aria-hidden="true">
          {{ group.label }}
        </span>
        <button
          v-for="skin in group.skins"
          :key="skin.id"
          type="button"
          role="radio"
          :data-skin="skin.id"
          :aria-checked="skin.id === selected"
          :tabindex="skin.id === selected ? 0 : -1"
          :aria-label="skin.name"
          :title="skin.name"
          class="relative size-14 shrink-0 overflow-hidden rounded-button border bg-surface-2"
          :class="skin.id === selected ? 'border-accent ring-2 ring-accent' : 'border-border'"
          @click="emit('select', skin.id)"
        >
          <img v-if="!broken.has(skin.id)" :src="iconUrl(skin)" alt="" class="size-full object-cover" draggable="false" @error="broken.add(skin.id)" />
          <span v-else class="flex size-full items-center justify-center text-sm font-bold" :class="TINT[skin.group]">{{ initials(skin.name) }}</span>
          <span v-if="loading === skin.id" class="absolute inset-0 flex items-center justify-center bg-bg/50">
            <Icon name="loader" class="size-5 animate-spin text-text" />
          </span>
        </button>
      </template>
    </div>
    <div v-if="bar.overflowing" class="mt-1 h-0.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
      <div class="h-full rounded-full bg-accent" :style="{ width: bar.width, marginLeft: bar.left }" />
    </div>
  </div>
</template>
